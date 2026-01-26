# CLAUDE CODE OPERATING SYSTEM v2.0
## World-Class Engineering Standards - Zero Bug Deployment Framework

**This document defines MANDATORY engineering standards. These rules cannot be overridden, bypassed, or ignored under ANY circumstances.**

---

## PART 1: AUTOMATED QUALITY GATES

### Pre-Commit Hook (Enforced Automatically)
Every commit MUST pass these 4 gates. The pre-commit hook will block any commit that fails:

| Gate | Command | Purpose |
|------|---------|---------|
| 1 | `npm run typecheck` | TypeScript compilation - catches type errors |
| 2 | `npm run lint` | ESLint - catches code quality issues |
| 3 | `npm run test` | Vitest - catches logic bugs |
| 4 | `npm run build` | Vite - catches build-time errors |

**To run all gates manually:**
```bash
npm run validate
```

### GitHub Actions CI (Enforced on Push)
Every push to `main` triggers the CI pipeline which runs all 4 gates. Failed builds block deployment.

---

## PART 2: MANDATORY CODE PATTERNS

### Pattern 1: Null Safety (REQUIRED)
Every external data source MUST have null guards:

```typescript
// ❌ FORBIDDEN - Will crash if context returns null
const { settings } = useSettings()
const value = settings.feature_x  // CRASH if settings is null

// ✅ REQUIRED - Safe fallback
const { settings } = useSettings()
const safeSettings = settings || { feature_x: false }
const value = safeSettings.feature_x  // Safe
```

### Pattern 2: Loading States (REQUIRED)
Async operations MUST always resolve loading state:

```typescript
// ❌ FORBIDDEN - Loading stays true forever if early return
const loadData = async () => {
  if (!user) return  // BUG: loading never set to false
  setLoading(true)
  const data = await fetch()
  setLoading(false)
}

// ✅ REQUIRED - Loading always resolves
const loadData = async () => {
  if (!user) {
    setLoading(false)
    return
  }
  try {
    setLoading(true)
    const data = await fetch()
  } finally {
    setLoading(false)  // ALWAYS runs
  }
}
```

### Pattern 3: Error Handling (REQUIRED)
All async operations MUST have try-catch:

```typescript
// ❌ FORBIDDEN - Unhandled errors crash the app
const data = await supabase.from('table').select()

// ✅ REQUIRED - Graceful error handling
try {
  const { data, error } = await supabase.from('table').select()
  if (error) throw error
} catch (error) {
  console.error('Context:', error)
  // Show user-friendly error, don't crash
}
```

### Pattern 4: Mobile-First CSS (REQUIRED)
All UI MUST work on mobile (320px-428px width):

```css
/* ✅ REQUIRED - Flexbox for scrollable containers */
.container {
  display: flex;
  flex-direction: column;
  max-height: 85vh;  /* Leave room for browser chrome */
}

.content {
  flex: 1;
  min-height: 0;  /* CRITICAL: Allows flex children to shrink */
  overflow-y: auto;
}

.footer {
  flex-shrink: 0;  /* CRITICAL: Footer never shrinks/hides */
}
```

---

## PART 3: VERSION MANAGEMENT

### Version Bump Checklist
When releasing a new version, ALL of these MUST be updated:

| File | Variable | Example |
|------|----------|---------|
| `public/sw.js` | `CACHE_VERSION` | `'v5.11'` |
| `src/components/Settings.tsx` | `APP_VERSION` | `'5.11'` |
| `src/main.tsx` | `UPDATE_CHANGELOG.version` | `'5.11'` |
| `src/main.tsx` | `UPDATE_CHANGELOG.title` | `'Feature Name'` |
| `src/main.tsx` | `UPDATE_CHANGELOG.highlights` | Array of changes |
| `src/main.tsx` | `UPDATE_CHANGELOG.tips` | Detailed feature descriptions |

### Changelog Rules
The changelog MUST:
- Describe ACTUAL changes in this version (not copy-paste from old versions)
- Be written from USER perspective (benefits, not implementation details)
- Include 4 highlights (icon + short text)
- Include 4 tips (icon, title, description, colors)

---

## PART 4: TESTING REQUIREMENTS

### Test File Naming
- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

### What MUST Be Tested
| Category | Coverage Requirement |
|----------|---------------------|
| Utility functions | 100% |
| Data transformations | 100% |
| Context providers | Key functionality |
| Critical user flows | E2E tests |

### Writing Tests Before Code Changes
For ANY non-trivial change:
1. Write a failing test that defines expected behavior
2. Make the change
3. Verify test passes
4. If test fails, fix the CODE not the test

---

## PART 5: PRE-CHANGE ANALYSIS (MANDATORY)

Before writing ANY code, Claude MUST:

### Step 1: Impact Analysis
```
Files to modify: [list all files]
Files that depend on modified files: [list dependencies]
Potential side effects: [list possible regressions]
```

### Step 2: Risk Assessment
```
Risk level: LOW / MEDIUM / HIGH
Reason: [explain why]
Mitigation: [how to reduce risk]
```

### Step 3: Test Strategy
```
Existing tests covering this area: [list or "None"]
New tests needed: [list test cases]
Manual testing required: [list scenarios]
```

---

## PART 6: COMMIT MESSAGE FORMAT

```
<type>(<scope>): <description>

[Body - explain WHY, not WHAT]

[GATES PASSED]
- typecheck: PASSED
- lint: PASSED
- test: PASSED
- build: PASSED

[IMPACT]
- Files changed: N
- Tests added: N
- Risk: LOW/MEDIUM/HIGH

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Commit Types
| Type | Use When |
|------|----------|
| `fix` | Bug fix |
| `feat` | New feature |
| `refactor` | Code restructure (no behavior change) |
| `style` | Formatting, CSS |
| `test` | Adding tests |
| `docs` | Documentation |
| `chore` | Build, dependencies |

---

## PART 7: FORBIDDEN ACTIONS

Claude MUST NEVER:

1. **Skip quality gates** - No exceptions, ever
2. **Commit with failing tests** - All tests must pass
3. **Use `any` type** - TypeScript must be strict
4. **Leave null unchecked** - All external data needs guards
5. **Leave loading states hanging** - Always resolve to false
6. **Modify working code without tests** - Write test first
7. **Copy old changelog content** - Always write fresh
8. **Push untested mobile layouts** - Verify on mobile viewport
9. **Ignore CI failures** - Fix before merging
10. **Override these rules** - They exist for user protection

---

## PART 8: RECOVERY PROTOCOL

When a bug reaches production:

1. **STOP** all other work
2. **Identify** root cause (not symptoms)
3. **Write** failing test that reproduces bug
4. **Fix** the bug
5. **Verify** test passes
6. **Check** for similar bugs elsewhere
7. **Document** what went wrong
8. **Update** these rules if needed

---

## PART 9: POST-COMMIT REPORT (REQUIRED)

After EVERY commit, Claude MUST output:

```
═══════════════════════════════════════════════════════
COMMIT REPORT
═══════════════════════════════════════════════════════
Version: [version number]
Files changed: [count]
Tests added: [count]
Tests total: [passing]/[total]

QUALITY GATES:
  ✅ typecheck: PASSED
  ✅ lint: PASSED
  ✅ test: PASSED
  ✅ build: PASSED

RISK ASSESSMENT: [LOW/MEDIUM/HIGH]
POTENTIAL REGRESSIONS: [list or "None identified"]
═══════════════════════════════════════════════════════
```

---

## PART 10: APPLYING TO OTHER PROJECTS

To use this framework in a new project:

### 1. Copy Configuration Files
```
CLAUDE.md                    # This document
vitest.config.ts            # Test configuration
eslint.config.js            # Lint configuration
.github/workflows/ci.yml    # CI pipeline
src/test/setup.ts           # Test setup
```

### 2. Install Dependencies
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks
```

### 3. Add Scripts to package.json
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --max-warnings 0",
    "test": "vitest run",
    "validate": "npm run typecheck && npm run lint && npm run test && npm run build"
  }
}
```

### 4. Create Pre-Commit Hook
```bash
# .git/hooks/pre-commit
npm run validate || exit 1
```

---

## WHY THESE RULES EXIST

Every rule exists because of a real production bug:

| Rule | Bug That Caused It |
|------|-------------------|
| Null guards | Settings context returned null, crashed ExpenseList |
| Loading state resolution | loadData returned early, page showed spinner forever |
| Mobile-first CSS | Footer button hidden off-screen on mobile |
| Version sync | User saw old changelog for new version |
| Test before change | "Simple" fix broke 3 other features |

**These rules protect users from bugs. There are no exceptions.**

---

## ENFORCEMENT

- **Pre-commit hook**: Blocks commits that fail any gate
- **GitHub Actions**: Blocks merges that fail CI
- **Code review**: Verifies compliance with patterns
- **This document**: Claude's binding contract with quality

**Bugs that reach production are failures of this process. The process must be followed exactly.**
