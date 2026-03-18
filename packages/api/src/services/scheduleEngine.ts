import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'

// Lazy-load node-cron to avoid startup crash if not installed
let cron: typeof import('node-cron') | null = null
async function getCron() {
  if (!cron) {
    try {
      cron = await import('node-cron')
    } catch {
      console.warn('[ScheduleEngine] node-cron not available — scheduled triggers disabled')
    }
  }
  return cron
}

type CronTask = { stop: () => void }

export class ScheduleEngine {
  private tasks = new Map<string, CronTask>()
  private started = false

  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    const nodeCron = await getCron()
    if (!nodeCron) return

    try {
      const activeSchedules = await db
        .select()
        .from(schema.schedules)
        .where(eq(schema.schedules.isActive, true))

      for (const schedule of activeSchedules) {
        if (schedule.type === 'cron' && schedule.cronExpression) {
          this.registerCron(schedule.id, schedule.cronExpression, schedule.workflowId)
        }
      }

      console.log(`[ScheduleEngine] Started — ${activeSchedules.length} schedules registered`)
    } catch (err) {
      console.error('[ScheduleEngine] Failed to load schedules:', err)
    }
  }

  stop(): void {
    for (const task of this.tasks.values()) {
      task.stop()
    }
    this.tasks.clear()
    this.started = false
  }

  async register(scheduleId: string, type: string, cronExpression: string | null, workflowId: string): Promise<void> {
    const nodeCron = await getCron()
    if (!nodeCron || type !== 'cron' || !cronExpression) return
    this.registerCron(scheduleId, cronExpression, workflowId)
  }

  unregister(scheduleId: string): void {
    const task = this.tasks.get(scheduleId)
    if (task) {
      task.stop()
      this.tasks.delete(scheduleId)
    }
  }

  private registerCron(scheduleId: string, expression: string, workflowId: string): void {
    if (!cron) return
    try {
      if (!cron.validate(expression)) {
        console.warn(`[ScheduleEngine] Invalid cron expression for schedule ${scheduleId}: ${expression}`)
        return
      }

      // Remove existing task if re-registering
      this.unregister(scheduleId)

      const task = cron.schedule(expression, () => {
        this.fireWorkflow(scheduleId, workflowId).catch((err) => {
          console.error(`[ScheduleEngine] Workflow fire failed for schedule ${scheduleId}:`, err)
        })
      })

      this.tasks.set(scheduleId, task)
    } catch (err) {
      console.error(`[ScheduleEngine] Failed to register schedule ${scheduleId}:`, err)
    }
  }

  async fireWorkflow(scheduleId: string, workflowId: string, context: Record<string, unknown> = {}): Promise<void> {
    const { v4: uuidv4 } = await import('uuid')

    // Record that it fired
    await db
      .update(schema.schedules)
      .set({ lastRunAt: new Date().toISOString() })
      .where(eq(schema.schedules.id, scheduleId))

    // Create a workflow run
    const runId = uuidv4()
    await db.insert(schema.workflowRuns).values({
      id: runId,
      workflowId,
      status: 'pending',
      context: JSON.stringify(context),
    })

    // Execute the workflow asynchronously (fire-and-forget style with error capture)
    this.executeWorkflowRun(runId, workflowId, context).catch((err) => {
      console.error(`[ScheduleEngine] Workflow run ${runId} failed:`, err)
      db.update(schema.workflowRuns)
        .set({ status: 'failed', error: String(err), completedAt: new Date().toISOString() })
        .where(eq(schema.workflowRuns.id, runId))
        .catch(console.error)
    })
  }

  private async executeWorkflowRun(runId: string, workflowId: string, _context: Record<string, unknown>): Promise<void> {
    const { ClaudeAgent } = await import('@claudeforge/agents')
    const { v4: uuidv4 } = await import('uuid')

    const [workflow] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, workflowId))
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    await db.update(schema.workflowRuns)
      .set({ status: 'running' })
      .where(eq(schema.workflowRuns.id, runId))

    const steps = JSON.parse(workflow.steps ?? '[]') as Array<{ agentId: string; inputTemplate: string; outputKey: string }>
    const ctx: Record<string, string> = {}
    const stepResults: Array<{ step: number; agentId: string; output: string; success: boolean }> = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!
      const [agentRow] = await db.select().from(schema.agents).where(eq(schema.agents.id, step.agentId))
      if (!agentRow) continue

      const input = step.inputTemplate.replaceAll(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? '')

      const agent = new ClaudeAgent({
        name: agentRow.name,
        model: (agentRow.model ?? 'auto') as import('@claudeforge/core').ClaudeModel | 'auto',
        systemPrompt: agentRow.systemPrompt ?? '',
        maxTokens: agentRow.maxTokens ?? 8192,
        logUsage: false,
      })

      const result = await agent.run(input)
      ctx[step.outputKey] = result.output
      stepResults.push({ step: i + 1, agentId: step.agentId, output: result.output, success: result.success })

      await db.insert(schema.usageEvents).values({
        id: uuidv4(),
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.usage.costUsd,
      })
    }

    await db.update(schema.workflowRuns)
      .set({
        status: 'completed',
        stepResults: JSON.stringify(stepResults),
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.workflowRuns.id, runId))
  }
}

export const scheduleEngine = new ScheduleEngine()
