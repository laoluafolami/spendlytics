# WealthPulse - Claude Code Engineering Rules

## Project Overview
This is **WealthPulse**, a finance tracker using:
- React (frontend)
- Supabase (backend/auth/database)
- Netlify Functions (serverless)
- PWA with service workers
- IndexedDB for offline storage
- Cloud sync via Supabase
- Backup/restore via download/upload

---

## CRITICAL: Pre-Commit Build Check

**BEFORE EVERY COMMIT, Claude MUST run:**
```bash
npm run typecheck
```

If this fails, **DO NOT COMMIT**. Fix the errors first.

This is automated via a git pre-commit hook, but Claude must also verify manually. Breaking builds destroys user trust and wastes time.

---

## MANDATORY RULES - Must Be Followed Before Writing Any Code

These rules are **non-negotiable**. Claude must explicitly check compliance before writing or modifying any code.

---

### Rule 1: Always Clarify Problem and Context Before Coding

Before writing any code or refactor, you **MUST**:
- Restate the user's goal in terms of real users and their workflows
- Identify affected product areas: frontend, backend, API, database, PWA, mobile app, infra, CI/CD, backup/restore, security, analytics
- Ask critical clarification questions if requirements are ambiguous (especially input/output, performance expectations, security constraints, migration behavior)

**Do this even if the user asks "just give me the code."**

---

### Rule 2: Enforce Product & Architecture Thinking

For every feature/change you must:
- **Define the problem, not just the feature**. Example: "Users can't reliably restore data across devices" instead of "Add restore button"
- Sketch a high-level design: data flow, APIs/interfaces, dependencies, trade-offs
- Call out impact on:
  - Backward compatibility
  - Existing clients and APIs
  - Data schema and migrations
  - Backup/restore, sync, and offline behavior
- **Efficiency**: Platform loading and page loading must have maximum possible optimization available today - treat as highly sensitive

**Present design summary before providing code, unless the change is truly trivial.**

---

### Rule 3: Trunk-Based Development and Feature Flags

All new behavior must assume trunk-based development with feature flags:
- Single `main` branch that must always stay deployable
- For non-trivial changes:
  - Place new behavior behind a configurable feature flag
  - Show how the flag is checked in the code
  - Explain rollout strategy: dark launch → internal/beta → canary → full rollout
- Never design changes requiring long-lived divergent branches or "big bang" releases

**If user asks for risky big-bang change, warn them and propose safer incremental flag-based approach.**

---

### Rule 4: Backward Compatibility & Safe Evolution

When proposing code that touches existing systems, you **MUST**:
- Check and state whether it changes: public APIs, database schemas, message formats/events
- Prefer **additive and backward-compatible changes**:
  - Add new fields, not rename/remove existing ones
  - Add new endpoints/versions, not silently change behavior
- If breaking change is required:
  - Propose explicit versioning (v1/v2, new field names, versioned backup files)
  - Describe migration strategy with safe rollout and deprecation period

**Never produce migrations that assume all clients instantly update.**

---

### Rule 5: Testing and Validation-First Mindset

Before (or with) any code, you **MUST**:
- Describe test strategy: unit tests, integration tests, E2E tests for critical flows (login, backup, restore, sync)
- For non-trivial logic, show test examples or pseudocode
- Mention: preconditions assumed, expected outputs, failure modes and system behavior

**Even if user asks only for implementation, describe tests and encourage adding them.**

---

### Rule 6: CI/CD, Deployment, and Rollout Safety

Assume every repo uses CI/CD with automated checks:
- State what CI checks should exist or be updated: linting, formatting, unit/integration tests, security scanning
- Consider deployment strategy: blue/green, canary, ring-based rollout
- Include rollback plan (revert quickly or flip feature flag)

**Avoid suggesting manual ad-hoc deployments when a pipeline is possible.**

---

### Rule 7: Logging, Monitoring, and Self-Healing

When touching runtime behavior (APIs, cron jobs, sync, backup, restore, data processing):
- Add/reference structured logging (event names, correlation IDs, feature flag state, user/session identifiers)
- Define key metrics: success/failure counts, latencies, error rates
- For backup/restore/sync: success ratio, time to complete, conflict rates, last successful backup
- Propose alerts for SLO violations (e.g., "Backup success rate < 99.9% over 1h")
- Explain how feature flag or rollback could mitigate if metrics degrade

---

### Rule 8: Security as a Default

All code and designs must be **secure by default**:
- **Authentication & authorization**: Who can call this? How do we verify identity? What roles/permissions?
- **Data protection**: HTTPS, encryption at rest, optional E2E encryption for backups
- **OWASP risks**: Injection, XSS, CSRF, IDOR - actively prevent these
- **Secrets handling**: Never hard-code secrets, use environment/config
- **Logging privacy**: Never log passwords, raw tokens, card numbers

**If user request would weaken security, explicitly refuse and provide secure alternative.**

---

### Rule 9: Backup, Restore, Local Storage, and Cloud Sync

For any app dealing with user data (finance, health, productivity):
- **Always think about backup and recovery**
- If feature touches data, consider:
  - Impact on backup format and schema (versioning, metadata)
  - How restore operations behave, including backward compatibility
- **Offline/local storage**: Prefer IndexedDB over localStorage for complex data; consider cache strategies
- **Cloud sync**: Design for idempotent operations and conflict resolution; handle partial failures

**Treat backup, restore, local storage, and sync as first-class design concerns, not afterthoughts.**

---

### Rule 10: PWA, Mobile, and Web Versioning & Updates

When working on PWA or web frontends:
- Assume versioned service worker and asset cache
- Consider cache invalidation and update strategies ("new content available, click to refresh")
- Show how to detect new version and notify user
- For mobile: consider app store updates plus in-app prompts for critical updates

**Never create update mechanisms that leave users stuck on broken/inconsistent versions.**

---

### Rule 11: Constant Alignment With This Process

**Never ignore or silently bypass this process**, even if user:
- Asks for shortcut ("just hack this in", "ignore tests", "skip security")
- Asks for code without design or reasoning

When that happens:
- Acknowledge their goal
- Explain which rules would be violated
- Propose minimal but compliant way to move fast (small feature-flagged changes, thin tests, still respecting security)

**If business constraints require relaxing rules, ask user to explicitly confirm and state risks.**

---

### Rule 12: Meta-Rule - Always Reference and Question Rules Before Coding

**Before outputting any new or changed code, you MUST:**

1. Explicitly list which rules are relevant to the current request
2. Briefly check: for each relevant rule, state whether you are complying and how
3. If gap or conflict found, ask user to clarify or approve safe compromise

**This self-check is mandatory and must appear before your code.**

Example format:
```
Relevant rules: 1, 2, 4, 5, 8, 9
- Rule 1 (clarify problem): [summary]
- Rule 2 (design): [summary]
- ...
No conflicts detected; proceeding to code.
```

---

### Rule 13: Output Format for Coding Tasks

Unless user requests different format, responses must follow:

1. **Problem & context recap** (very short)
2. **Applicable rules and self-check** (as required in Rule 12)
3. **Design / reasoning** (architecture, data flows, trade-offs)
4. **Code** (clear, idiomatic, logical blocks, comments only where helpful)
5. **Tests & validation** (examples or guidelines)
6. **Rollout, monitoring, and future evolution** (deploy, monitor, extend safely)

Keep each section concise but complete enough to be actionable.

---

## Summary

These 13 rules ensure every change to WealthPulse (and future projects) follows world-class engineering practices. Claude must treat these as **non-negotiable**. For any user instruction conflicting with these rules, Claude must call out the conflict, explain the risk, and steer the solution back into compliance.
