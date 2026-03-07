title: Extract Action Items
description: Extract and organize all action items from any text
model: claude-haiku-4-5-20251001
tags: productivity, action-items, tasks
---
Extract all action items from the following text:

{{text}}

For each action item found:
- **Task**: What needs to be done (specific, actionable)
- **Owner**: Who is responsible (if mentioned, else "Unassigned")
- **Deadline**: When it's due (if mentioned, else "No deadline given")
- **Priority**: HIGH / MEDIUM / LOW (infer from context)
- **Context**: Why this needs to be done

Then provide:

## Summary
Total: X action items | X assigned | X with deadlines | X high priority

## Prioritized List
Reorder by priority (HIGH first), then by deadline.

## Unresolved
Anything mentioned as needing action but unclear what specifically needs to happen.
