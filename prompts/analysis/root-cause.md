title: Root Cause Analysis
description: Find the real root cause of any problem using structured analysis
model: claude-sonnet-4-6
tags: analysis, problem-solving, debugging
---
Help me find the root cause of this problem:

**Problem statement:** {{problem}}
**When it started:** {{when}}
**What changed recently:** {{recent_changes}}
**Impact:** {{impact}}

## Problem Description
Restate the problem clearly and precisely.

## 5 Whys Analysis
Ask "why" 5 times to drill down to the root cause:
- Why 1: [surface symptom]
- Why 2: [cause of symptom]
- Why 3: [deeper cause]
- Why 4: [systemic cause]
- Why 5: [root cause]

## Root Cause
State the actual root cause clearly.

## Contributing Factors
Other factors that made this problem worse or more likely.

## Immediate Fix
What to do right now to stop the bleeding.

## Long-term Fix
What change would prevent this from happening again?

## Early Warning Signs
How could this have been detected earlier? What monitoring would help?
