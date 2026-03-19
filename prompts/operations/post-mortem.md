title: Blameless Post-Mortem
description: Run a blameless post-mortem for an incident or project failure with timeline, root cause, and action items
model: claude-sonnet-4-6
tags: operations, post-mortem, incident, learning
---
Write a blameless post-mortem for the following incident or project failure.

**Incident/failure:** {{incident_description}}

**Date/period:** {{incident_date}}

**Impact:** {{impact}} (e.g., customers affected, revenue lost, downtime duration)

**People involved:** {{people_involved}}

**Timeline of events (rough notes):**
{{timeline_notes}}

**What we know went wrong:** {{what_went_wrong}}

**What we know went right:** {{what_went_right}}

Structure the post-mortem as follows:

**INCIDENT SUMMARY**
What happened, when, and what the impact was. 3–5 sentences. Non-technical version.

**TIMELINE**
Chronological sequence of events:
| Time | Event | Who |

**IMPACT ASSESSMENT**
- Customer impact: [number affected, nature of impact]
- Business impact: [revenue, SLA breach, reputation]
- Duration: [detection time, resolution time, total outage]

**ROOT CAUSE ANALYSIS**
Use the "5 Whys" method to find the systemic root cause (not just the trigger).
Why #1: [surface cause]
Why #2: [deeper cause]
Why #3: [deeper still]
...
Root Cause: [the systemic issue]

**CONTRIBUTING FACTORS**
Other factors that made the impact worse or recovery slower.

**WHAT WENT WELL**
Honest recognition of good decisions and actions during the incident.

**ACTION ITEMS**
| Action | Owner | Due Date | Priority |

Priority tiers:
- PREVENT: changes to prevent recurrence
- DETECT: improve monitoring/alerting
- RESPOND: improve incident response
- RECOVER: reduce time to resolution

**LESSONS LEARNED**
3–5 key learnings that apply beyond this specific incident.
