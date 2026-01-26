# CLAUDE.md - Project Standards (Copy to Project Root)

> Copy this file as `CLAUDE.md` in your project root. Claude Code reads this automatically.

---

# MANDATORY: Quality Gates

Every commit MUST pass all 4 gates. Run `npm run validate` before committing.

| Gate | Command | Failure = Blocked Commit |
|------|---------|--------------------------|
| 1. TypeScript | `npm run typecheck` | Yes |
| 2. ESLint | `npm run lint` | Yes |
| 3. Tests | `npm run test` | Yes |
| 4. Build | `npm run build` | Yes |

---

# MANDATORY: Code Patterns

## 1. Null Safety (Always use)

```typescript
// Context/API values can be null - ALWAYS guard
const { settings } = useSettings()
const safeSettings = settings ?? { feature_x: false }

// Property access - ALWAYS use optional chaining
const name = user?.profile?.name ?? 'Anonymous'
```

## 2. Loading States (Always resolve)

```typescript
const loadData = async () => {
  if (!user) {
    setLoading(false)  // MUST resolve on early return
    return
  }
  try {
    setLoading(true)
    const data = await fetchData()
  } finally {
    setLoading(false)  // ALWAYS runs
  }
}
```

## 3. Error Handling (Always catch)

```typescript
try {
  await riskyOperation()
} catch (error) {
  console.error('Operation failed:', error)
  // Handle gracefully
}
```

## 4. Arrays (Always provide fallback)

```typescript
const items = (data ?? []).map(item => item.name)
```

---

# MANDATORY: Before Every Commit

1. [ ] Run `npm run validate` - all 4 gates pass
2. [ ] Increment version number
3. [ ] Update changelog if user-facing
4. [ ] No console.log (only console.warn/error)
5. [ ] No hardcoded secrets

---

# FORBIDDEN Actions

```typescript
// ❌ NEVER access potentially null values directly
settings.feature  // Crash if null!

// ❌ NEVER forget loading resolution
if (!user) return  // Loading stuck forever!

// ❌ NEVER ignore errors
catch (e) {}  // Silent failure!

// ❌ NEVER use @ts-ignore
// @ts-ignore

// ❌ NEVER commit secrets
const API_KEY = 'sk-...'  // Use env vars!
```

```bash
# ❌ NEVER force push to main
git push --force origin main

# ❌ NEVER skip hooks
git commit --no-verify
```

---

# Version Management

Location: `public/sw.js` or `src/constants/version.ts`

| Change Type | Increment |
|-------------|-----------|
| Bug fix | x.x.PATCH |
| Feature | x.MINOR.0 |
| Breaking | MAJOR.0.0 |

---

# Commit Message Format

```
type(scope): description

Types: feat, fix, docs, refactor, test, chore
Example: fix(auth): resolve session timeout crash
```

---

# Setup Commands (New Projects)

```bash
# Install quality tools
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks

# Add scripts to package.json
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.lint="eslint src"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.validate="npm run typecheck && npm run lint && npm run test && npm run build"

# Copy config files from CLAUDE_CODE_OS_v3_TEMPLATE.md Section 12
```

---

# Quick Reference

```bash
npm run validate    # All gates
npm run typecheck   # TypeScript only
npm run lint        # ESLint only
npm run test        # Tests only
npm run lint:fix    # Auto-fix lint
```

```typescript
// Safe patterns
value ?? default
obj?.prop?.deep ?? fallback
(array ?? []).map(...)
try {} finally { setLoading(false) }
```
