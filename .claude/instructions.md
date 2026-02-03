# Claude Code Operating Instructions

**MANDATORY**: Follow the process defined in `project_documentation/claude_code_os.txt` strictly for ALL code changes.

## Before Writing ANY Code

You MUST show a rule self-check in this format:

```
Relevant rules: [list numbers]
- Rule 1 (clarify): [summary]
- Rule 2 (design): [summary]
- Rule 3 (feature flags): [summary]
- Rule 4 (compatibility): [summary]
- Rule 5 (testing): [summary]
- Rule 6 (CI/CD): [summary]
- Rule 7 (monitoring): [summary]
- Rule 8 (security): [summary]
- Rule 9 (backup/sync): [summary]
- Rule 10 (versioning): [summary]
[State conflicts or "No conflicts. Proceeding."]
```

## Quick Reference: The 13 Rules

1. **Clarify problem/context** - Restate goal, identify affected areas, ask clarifying questions
2. **Product & architecture thinking** - Define problem, sketch design, call out impacts
3. **Trunk-based dev + feature flags** - Keep main deployable, flag new behavior, incremental rollout
4. **Backward compatibility** - Additive changes, versioned APIs, migration strategies
5. **Testing first** - Unit, integration, E2E tests; describe test strategy before/with code
6. **CI/CD safety** - State required checks, deployment strategy, rollback plan
7. **Logging & monitoring** - Structured logs, metrics, alerts, SLOs
8. **Security by default** - Auth, encryption, OWASP risks, no hardcoded secrets
9. **Backup/restore/sync** - Schema versioning, offline storage, conflict resolution
10. **PWA/web versioning** - Service worker updates, cache invalidation, user notifications
11. **Never bypass process** - Explain conflicts, propose compliant alternatives
12. **Meta-rule** - Explicitly list and check rules before coding
13. **Output format** - Problem recap, rule check, design, code, tests, rollout

## Project Context: WealthPulse

- **Stack**: React, Supabase, Netlify Functions, PWA with service workers
- **Storage**: IndexedDB for offline, Supabase for cloud sync
- **Critical flows**: Backup/restore via download/upload, cloud sync
- **Security**: Financial data - treat as highly sensitive
- **Efficiency**: platform loading and page loading must have maximum possible optimization available today - treat as highly sensitive

## DEPLOYMENT (MANDATORY)

**Netlify Production Site**: steady-blini-ec1c85.netlify.app

**Git Deployment Process** (MUST follow exactly):
1. Commit to `main` branch first
2. Checkout `life-goals-beta` branch: `git checkout life-goals-beta`
3. Merge main: `git merge main --no-edit`
4. Push to `koredius` remote: `git push koredius life-goals-beta`

**NEVER** push only to `origin` or only to `main` when deploying - Netlify deploys from:
- **Remote**: `koredius` (https://github.com/Koredius/wealthpulse-beta.git)
- **Branch**: `life-goals-beta`

After pushing, verify deploy started at: https://app.netlify.com/sites/steady-blini-ec1c85/deploys

## Red Flags (Never Do These)

- Write code without rule self-check
- Remove/rename API fields without migration plan
- Skip feature flags for non-trivial changes
- Ignore backup/sync implications when touching data
- Omit test strategy
- Hardcode secrets or suggest insecure patterns
- Propose "big bang" releases when incremental is possible
- **Push to wrong remote/branch** - ALWAYS use `koredius` remote + `life-goals-beta` branch for Netlify deploys

## User Verification Commands

The user may ask at any time:
- "Which rules apply here?"
- "Audit check" - Full compliance review
- "Security check?" / "Backup check?" / "Compatibility check?"

Always respond thoroughly to these verification requests.
