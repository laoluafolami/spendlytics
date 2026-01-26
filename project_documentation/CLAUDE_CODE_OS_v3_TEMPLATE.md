# Claude Code Operating System v3.0
## Enterprise-Grade Development Framework

> **Purpose**: A comprehensive, internationally best-practiced development standard that ensures zero-regression deployments, maintains code quality, and scales across any application.

---

# TABLE OF CONTENTS

1. [Quick Start Checklist](#1-quick-start-checklist)
2. [Quality Gates Architecture](#2-quality-gates-architecture)
3. [Mandatory Code Patterns](#3-mandatory-code-patterns)
4. [Version Management Protocol](#4-version-management-protocol)
5. [Git Workflow Standards](#5-git-workflow-standards)
6. [Testing Requirements](#6-testing-requirements)
7. [Error Handling Standards](#7-error-handling-standards)
8. [Security Practices](#8-security-practices)
9. [Performance Guidelines](#9-performance-guidelines)
10. [Documentation Standards](#10-documentation-standards)
11. [Debugging Protocol](#11-debugging-protocol)
12. [Configuration Files](#12-configuration-files)
13. [Forbidden Actions](#13-forbidden-actions)
14. [Incident Response](#14-incident-response)

---

# 1. QUICK START CHECKLIST

## First-Time Project Setup

```bash
# 1. Initialize quality tools
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D eslint-plugin-react-hooks

# 2. Add scripts to package.json
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.lint="eslint src"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.validate="npm run typecheck && npm run lint && npm run test && npm run build"

# 3. Create configuration files (see Section 12)
# 4. Set up pre-commit hook (see Section 12)
# 5. Create CI workflow (see Section 12)
```

## Before Every Coding Session

1. [ ] Run `npm run validate` to verify clean baseline
2. [ ] Check current version in service worker / constants
3. [ ] Review recent commits for context
4. [ ] Identify files that will be modified

## Before Every Commit

1. [ ] All 4 quality gates pass locally
2. [ ] Version number incremented
3. [ ] Changelog updated (if user-facing)
4. [ ] No `console.log` statements (use `console.warn`/`console.error` only)
5. [ ] No hardcoded secrets or API keys

---

# 2. QUALITY GATES ARCHITECTURE

## The 4 Mandatory Gates

Every commit MUST pass all 4 gates. No exceptions.

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMIT ATTEMPT                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  GATE 1: TypeScript Compilation                             │
│  Command: npm run typecheck                                 │
│  Purpose: Catch type errors, missing imports, syntax issues │
│  Failure: BLOCKS COMMIT                                     │
└─────────────────────────────────────────────────────────────┘
                            │ PASS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  GATE 2: ESLint Code Quality                                │
│  Command: npm run lint                                      │
│  Purpose: Enforce code standards, catch anti-patterns       │
│  Failure: BLOCKS COMMIT                                     │
└─────────────────────────────────────────────────────────────┘
                            │ PASS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  GATE 3: Unit Tests                                         │
│  Command: npm run test                                      │
│  Purpose: Verify business logic, catch regressions          │
│  Failure: BLOCKS COMMIT                                     │
└─────────────────────────────────────────────────────────────┘
                            │ PASS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  GATE 4: Production Build                                   │
│  Command: npm run build                                     │
│  Purpose: Verify bundling, catch runtime issues             │
│  Failure: BLOCKS COMMIT                                     │
└─────────────────────────────────────────────────────────────┘
                            │ PASS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    COMMIT APPROVED                          │
└─────────────────────────────────────────────────────────────┘
```

## Gate Enforcement Locations

| Location | Trigger | Action on Failure |
|----------|---------|-------------------|
| Pre-commit Hook | `git commit` | Block commit locally |
| GitHub Actions | Push to main/develop | Block merge, notify team |
| PR Checks | Pull request | Block merge until fixed |

---

# 3. MANDATORY CODE PATTERNS

## Pattern 1: Null Safety (CRITICAL)

Context values, API responses, and optional data can be `null` or `undefined`. Always guard against this.

```typescript
// ❌ FORBIDDEN - Will crash if context returns null
const { settings } = useSettings()
const value = settings.feature_x  // CRASH if settings is null

// ✅ REQUIRED - Safe fallback pattern
const { settings } = useSettings()
const safeSettings = settings ?? {
  feature_x: false,
  feature_y: false,
  // ... all expected properties with defaults
}
const value = safeSettings.feature_x  // Safe
```

```typescript
// ❌ FORBIDDEN - Unsafe property access
const userName = user.profile.name

// ✅ REQUIRED - Optional chaining with fallback
const userName = user?.profile?.name ?? 'Anonymous'
```

## Pattern 2: Loading State Resolution (CRITICAL)

Every async operation MUST resolve its loading state in ALL code paths.

```typescript
// ❌ FORBIDDEN - Loading never resolves on early return
const loadData = async () => {
  setLoading(true)
  if (!user) return  // BUG: loading stays true forever!

  const data = await fetchData()
  setLoading(false)
}

// ✅ REQUIRED - Loading resolves in ALL paths
const loadData = async () => {
  if (!user) {
    setLoading(false)  // Explicit resolution
    return
  }

  setLoading(true)
  try {
    const data = await fetchData()
    setData(data)
  } catch (error) {
    setError(error)
  } finally {
    setLoading(false)  // ALWAYS runs
  }
}
```

## Pattern 3: Async/Await Error Handling (CRITICAL)

Every async operation MUST have error handling.

```typescript
// ❌ FORBIDDEN - Unhandled promise rejection
const saveData = async () => {
  const result = await api.save(data)
  return result
}

// ✅ REQUIRED - Proper error handling
const saveData = async () => {
  try {
    const result = await api.save(data)
    return { success: true, data: result }
  } catch (error) {
    console.error('Save failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

## Pattern 4: Array Safety (REQUIRED)

Always provide fallbacks for array operations.

```typescript
// ❌ FORBIDDEN - Crashes if data is undefined
const items = data.map(item => item.name)

// ✅ REQUIRED - Safe array operations
const items = (data ?? []).map(item => item.name)

// ✅ ALSO ACCEPTABLE - Guard clause
if (!Array.isArray(data)) return []
const items = data.map(item => item.name)
```

## Pattern 5: Event Handler Safety (REQUIRED)

Prevent event propagation issues and handle edge cases.

```typescript
// ❌ FORBIDDEN - No error boundary
const handleClick = (e: React.MouseEvent) => {
  doSomething()
}

// ✅ REQUIRED - Defensive event handling
const handleClick = (e: React.MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  try {
    doSomething()
  } catch (error) {
    console.error('Click handler failed:', error)
  }
}
```

## Pattern 6: Form Input Validation (REQUIRED)

Validate all user inputs before processing.

```typescript
// ❌ FORBIDDEN - No validation
const handleSubmit = (data: FormData) => {
  api.submit(data)
}

// ✅ REQUIRED - Input validation
const handleSubmit = (data: FormData) => {
  // Validate required fields
  if (!data.email?.trim()) {
    setError('Email is required')
    return
  }

  // Validate format
  if (!isValidEmail(data.email)) {
    setError('Invalid email format')
    return
  }

  // Sanitize before submission
  const sanitized = {
    email: data.email.trim().toLowerCase(),
    name: sanitizeString(data.name)
  }

  api.submit(sanitized)
}
```

## Pattern 7: Component Unmount Safety (REQUIRED)

Prevent state updates on unmounted components.

```typescript
// ❌ FORBIDDEN - May update unmounted component
useEffect(() => {
  fetchData().then(data => {
    setData(data)  // May run after unmount!
  })
}, [])

// ✅ REQUIRED - Cleanup pattern
useEffect(() => {
  let isMounted = true

  fetchData().then(data => {
    if (isMounted) {
      setData(data)
    }
  })

  return () => {
    isMounted = false
  }
}, [])

// ✅ ALSO GOOD - AbortController pattern
useEffect(() => {
  const controller = new AbortController()

  fetchData({ signal: controller.signal })
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') {
        console.error(err)
      }
    })

  return () => controller.abort()
}, [])
```

---

# 4. VERSION MANAGEMENT PROTOCOL

## Version Location

Every application MUST have a single source of truth for version:

```typescript
// src/constants/version.ts (or in service worker for PWAs)
export const APP_VERSION = '1.0.0'
export const BUILD_DATE = '2024-01-15'
```

## Version Increment Rules

| Change Type | Version Part | Example |
|-------------|--------------|---------|
| Bug fix | Patch (x.x.X) | 1.0.0 → 1.0.1 |
| New feature | Minor (x.X.0) | 1.0.1 → 1.1.0 |
| Breaking change | Major (X.0.0) | 1.1.0 → 2.0.0 |

## Mandatory Version Update Checklist

For EVERY deployment:

1. [ ] Increment version number
2. [ ] Update service worker cache version (PWAs)
3. [ ] Update changelog with user-friendly description
4. [ ] Tag release in git: `git tag v1.2.3`

```typescript
// Example changelog structure
const CHANGELOG = {
  version: '1.2.3',
  date: '2024-01-15',
  changes: [
    { type: 'feature', description: 'Added dark mode support' },
    { type: 'fix', description: 'Fixed login timeout issue' },
    { type: 'improvement', description: 'Faster page load times' }
  ]
}
```

---

# 5. GIT WORKFLOW STANDARDS

## Branch Naming Convention

```
feature/[ticket-id]-short-description
bugfix/[ticket-id]-short-description
hotfix/[ticket-id]-short-description
release/v1.2.3
```

Examples:
- `feature/WP-123-add-dark-mode`
- `bugfix/WP-456-fix-login-crash`
- `hotfix/WP-789-security-patch`

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Build process or auxiliary tool changes

### Examples

```bash
# Feature
git commit -m "feat(auth): add biometric login support

Implements fingerprint and face recognition for supported devices.
Includes fallback to PIN for unsupported devices.

Closes #123"

# Bug fix
git commit -m "fix(expenses): resolve blank page on null settings

Added null safety guard for settings context.
Loading state now properly resolves on all code paths.

Fixes #456"
```

## Pull Request Checklist

Before requesting review:

- [ ] All 4 quality gates pass
- [ ] Version incremented
- [ ] Self-reviewed all changes
- [ ] No commented-out code
- [ ] No TODO comments (create issues instead)
- [ ] Documentation updated if needed
- [ ] Tests added for new functionality

---

# 6. TESTING REQUIREMENTS

## Test File Location

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx    # Co-located tests
├── utils/
│   ├── helpers.ts
│   └── helpers.test.ts
└── test/
    └── setup.ts           # Global test setup
```

## Minimum Test Coverage

| Category | Requirement |
|----------|-------------|
| Utility functions | 100% coverage |
| Business logic | 90% coverage |
| Component rendering | Key paths tested |
| Error states | All error paths tested |
| Edge cases | Null, undefined, empty arrays |

## Required Test Categories

### 1. Null Safety Tests

```typescript
describe('Null Safety', () => {
  it('handles null context gracefully', () => {
    const settings = null
    const safeSettings = settings ?? { feature_x: false }
    expect(safeSettings.feature_x).toBe(false)
  })

  it('handles undefined properties', () => {
    const user: { name?: string } = {}
    const name = user.name ?? 'Anonymous'
    expect(name).toBe('Anonymous')
  })
})
```

### 2. Loading State Tests

```typescript
describe('Loading States', () => {
  it('resolves loading on early return', async () => {
    let loading = true

    const loadData = async (hasUser: boolean) => {
      if (!hasUser) {
        loading = false
        return
      }
      loading = false
    }

    await loadData(false)
    expect(loading).toBe(false)
  })

  it('resolves loading on error', async () => {
    let loading = true

    const loadData = async () => {
      try {
        throw new Error('Test error')
      } finally {
        loading = false
      }
    }

    await loadData().catch(() => {})
    expect(loading).toBe(false)
  })
})
```

### 3. Input Validation Tests

```typescript
describe('Input Validation', () => {
  it('rejects empty email', () => {
    expect(validateEmail('')).toBe(false)
  })

  it('rejects invalid email format', () => {
    expect(validateEmail('notanemail')).toBe(false)
  })

  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true)
  })

  it('handles null input', () => {
    expect(validateEmail(null as any)).toBe(false)
  })
})
```

### 4. Error Handling Tests

```typescript
describe('Error Handling', () => {
  it('returns error object on API failure', async () => {
    const mockApi = { save: jest.fn().mockRejectedValue(new Error('Network error')) }

    const result = await saveData(mockApi, {})

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })
})
```

---

# 7. ERROR HANDLING STANDARDS

## Error Boundary Implementation

Every application MUST have a root error boundary:

```typescript
// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    console.error('Error caught by boundary:', error, errorInfo)

    // Send to monitoring service (Sentry, LogRocket, etc.)
    // errorReportingService.captureException(error, { extra: errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="error-fallback">
          <h1>Something went wrong</h1>
          <p>Please refresh the page or contact support.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

## API Error Handling Pattern

```typescript
// src/lib/api.ts
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.message ?? `Request failed with status ${response.status}`,
          details: errorData,
        },
      }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
        details: error,
      },
    }
  }
}
```

## User-Friendly Error Messages

```typescript
// src/utils/errorMessages.ts
const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  HTTP_401: 'Your session has expired. Please log in again.',
  HTTP_403: 'You do not have permission to perform this action.',
  HTTP_404: 'The requested resource was not found.',
  HTTP_500: 'Something went wrong on our end. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
}

export function getUserFriendlyError(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN
}
```

---

# 8. SECURITY PRACTICES

## Environment Variables

```typescript
// ❌ FORBIDDEN - Hardcoded secrets
const API_KEY = 'sk-1234567890abcdef'

// ✅ REQUIRED - Environment variables
const API_KEY = import.meta.env.VITE_API_KEY

// ✅ REQUIRED - Validation at startup
if (!import.meta.env.VITE_API_KEY) {
  throw new Error('VITE_API_KEY environment variable is required')
}
```

## Input Sanitization

```typescript
// src/utils/sanitize.ts
import DOMPurify from 'dompurify'

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  })
}

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 1000) // Limit length
}

export function sanitizeNumber(input: unknown): number {
  const num = Number(input)
  return isNaN(num) ? 0 : num
}
```

## Authentication Token Handling

```typescript
// ❌ FORBIDDEN - Storing tokens in localStorage (XSS vulnerable)
localStorage.setItem('token', authToken)

// ✅ PREFERRED - HttpOnly cookies (set by server)
// Token is automatically included in requests

// ✅ ACCEPTABLE - If cookies not possible, use memory + sessionStorage
class TokenManager {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
    // Session storage is cleared when tab closes
    sessionStorage.setItem('token', token)
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = sessionStorage.getItem('token')
    }
    return this.token
  }

  clearToken() {
    this.token = null
    sessionStorage.removeItem('token')
  }
}
```

## OWASP Top 10 Checklist

- [ ] **Injection**: Parameterize all database queries
- [ ] **Broken Auth**: Use secure session management
- [ ] **Sensitive Data**: Encrypt data in transit (HTTPS) and at rest
- [ ] **XXE**: Disable external entity processing
- [ ] **Broken Access Control**: Verify permissions server-side
- [ ] **Security Misconfiguration**: Use security headers
- [ ] **XSS**: Sanitize all user input, use CSP
- [ ] **Insecure Deserialization**: Validate all serialized data
- [ ] **Vulnerable Components**: Keep dependencies updated
- [ ] **Logging**: Log security events, don't log sensitive data

---

# 9. PERFORMANCE GUIDELINES

## Bundle Size Limits

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 500, // KB
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
```

## Lazy Loading Pattern

```typescript
// ❌ FORBIDDEN - Importing everything upfront
import { HeavyComponent } from './HeavyComponent'

// ✅ REQUIRED - Lazy loading for large components
import { lazy, Suspense } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyComponent />
    </Suspense>
  )
}
```

## Memoization Guidelines

```typescript
// Use useMemo for expensive calculations
const sortedData = useMemo(() => {
  return [...data].sort((a, b) => a.date - b.date)
}, [data])

// Use useCallback for event handlers passed to children
const handleClick = useCallback((id: string) => {
  setSelected(id)
}, [])

// Use React.memo for pure components
const ListItem = React.memo(function ListItem({ item, onClick }) {
  return <li onClick={() => onClick(item.id)}>{item.name}</li>
})
```

## Image Optimization

```typescript
// ❌ FORBIDDEN - Unoptimized images
<img src="/photo.png" />

// ✅ REQUIRED - Optimized images
<img
  src="/photo.webp"
  srcSet="/photo-400.webp 400w, /photo-800.webp 800w"
  sizes="(max-width: 600px) 400px, 800px"
  loading="lazy"
  alt="Descriptive alt text"
/>
```

---

# 10. DOCUMENTATION STANDARDS

## Code Comments

```typescript
// ❌ FORBIDDEN - Obvious comments
// Increment counter by 1
counter++

// ✅ REQUIRED - Explain WHY, not WHAT
// Using optimistic update for better UX - reverts on API failure
setItems(prev => [...prev, newItem])

// ✅ REQUIRED - Document edge cases
// Safari doesn't support date input, fallback to text
const inputType = isSafari ? 'text' : 'date'
```

## JSDoc for Public APIs

```typescript
/**
 * Formats a number as currency with the specified symbol.
 *
 * @param amount - The numeric amount to format
 * @param symbol - Currency symbol (default: '$')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.5) // '$1,234.50'
 * formatCurrency(1234.5, '€') // '€1,234.50'
 */
export function formatCurrency(
  amount: number,
  symbol = '$',
  decimals = 2
): string {
  return `${symbol}${amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}
```

## README Template

Every project MUST have a README with:

1. Project description
2. Prerequisites
3. Installation steps
4. Development commands
5. Build and deployment
6. Environment variables
7. Architecture overview
8. Contributing guidelines

---

# 11. DEBUGGING PROTOCOL

## Before Making Changes

1. **Reproduce** - Confirm you can reproduce the bug
2. **Isolate** - Identify the minimal reproduction case
3. **Understand** - Read and understand the affected code
4. **Plan** - Determine the fix before coding

## Debug Logging (Development Only)

```typescript
// src/utils/debug.ts
const DEBUG = import.meta.env.DEV

export const debug = {
  log: (...args: unknown[]) => DEBUG && console.log('[DEBUG]', ...args),
  warn: (...args: unknown[]) => DEBUG && console.warn('[DEBUG]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args), // Always log errors
  table: (data: unknown) => DEBUG && console.table(data),
  time: (label: string) => DEBUG && console.time(label),
  timeEnd: (label: string) => DEBUG && console.timeEnd(label),
}
```

## State Inspection

```typescript
// Temporary debugging - REMOVE before commit
useEffect(() => {
  console.log('[DEBUG] State changed:', { user, settings, data })
}, [user, settings, data])
```

## Network Debugging

```typescript
// Add request/response logging in development
if (import.meta.env.DEV) {
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    console.log('[FETCH]', args[0])
    const response = await originalFetch(...args)
    console.log('[RESPONSE]', response.status, args[0])
    return response
  }
}
```

---

# 12. CONFIGURATION FILES

## vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
})
```

## src/test/setup.ts

```typescript
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
```

## eslint.config.js

```javascript
import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        crypto: 'readonly',
        indexedDB: 'readonly',
        caches: 'readonly',
        Image: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        structuredClone: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Quality
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'always'],

      // Disable conflicting rules
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'public/**',
    ],
  },
]
```

## .github/workflows/ci.yml

```yaml
name: CI Quality Gates

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  quality-gates:
    name: Quality Gates
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Gate 1 - TypeScript Check
        run: |
          echo "Running TypeScript compilation check..."
          npm run typecheck

      - name: Gate 2 - ESLint Check
        run: |
          echo "Running ESLint..."
          npm run lint

      - name: Gate 3 - Unit Tests
        run: |
          echo "Running unit tests..."
          npm run test

      - name: Gate 4 - Production Build
        run: |
          echo "Building for production..."
          npm run build

      - name: All Gates Passed
        run: |
          echo "All quality gates passed!"

  # Optional: Block deployment on failure
  deployment-gate:
    name: Deployment Gate
    needs: quality-gates
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Deployment Approved
        run: echo "All quality gates passed - deployment approved"
```

## .git/hooks/pre-commit

```bash
#!/bin/sh
#
# QUALITY GATES - Pre-commit Hook
# Blocks commits if any quality gate fails
#

echo ""
echo "============================================================"
echo "       QUALITY GATES - Pre-commit Validation"
echo "============================================================"
echo ""

FAILED=0

# Gate 1: TypeScript Check
echo "[Gate 1/4] TypeScript Compilation..."
npm run typecheck > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "FAILED: TypeScript errors found"
  npm run typecheck
  FAILED=1
else
  echo "PASSED: TypeScript"
fi

# Gate 2: ESLint Check
if [ $FAILED -eq 0 ]; then
  echo "[Gate 2/4] ESLint Code Quality..."
  npm run lint > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "FAILED: Lint errors found"
    npm run lint
    FAILED=1
  else
    echo "PASSED: ESLint"
  fi
fi

# Gate 3: Unit Tests
if [ $FAILED -eq 0 ]; then
  echo "[Gate 3/4] Unit Tests..."
  npm run test > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "FAILED: Tests failed"
    npm run test
    FAILED=1
  else
    echo "PASSED: Tests"
  fi
fi

# Gate 4: Production Build
if [ $FAILED -eq 0 ]; then
  echo "[Gate 4/4] Production Build..."
  npm run build > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "FAILED: Build failed"
    npm run build
    FAILED=1
  else
    echo "PASSED: Build"
  fi
fi

echo ""

# Final verdict
if [ $FAILED -ne 0 ]; then
  echo "============================================================"
  echo "  COMMIT BLOCKED - Quality gate(s) failed"
  echo "============================================================"
  echo ""
  echo "Fix all errors above before committing."
  echo ""
  exit 1
else
  echo "============================================================"
  echo "  ALL GATES PASSED - Commit approved"
  echo "============================================================"
  echo ""
  exit 0
fi
```

## package.json scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "lint:strict": "eslint src --max-warnings 0",
    "lint:fix": "eslint src --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "validate": "npm run typecheck && npm run lint && npm run test && npm run build"
  }
}
```

---

# 13. FORBIDDEN ACTIONS

## Code Patterns - NEVER DO

```typescript
// ❌ NEVER: Catch and ignore errors silently
try {
  doSomething()
} catch (e) {
  // Swallowing errors hides bugs
}

// ❌ NEVER: Use eval or Function constructor
eval(userInput)
new Function(userInput)

// ❌ NEVER: Disable TypeScript checks
// @ts-ignore
// @ts-nocheck

// ❌ NEVER: Use any without justification
const data: any = response

// ❌ NEVER: Mutate props or state directly
props.items.push(newItem)
state.count++

// ❌ NEVER: Use index as key for dynamic lists
{items.map((item, index) => <Item key={index} {...item} />)}

// ❌ NEVER: Store sensitive data in localStorage
localStorage.setItem('password', userPassword)

// ❌ NEVER: Use dangerouslySetInnerHTML without sanitization
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

## Git Actions - NEVER DO

```bash
# ❌ NEVER: Force push to main/master
git push --force origin main

# ❌ NEVER: Commit secrets
git add .env
git add **/credentials.json
git add **/*.pem

# ❌ NEVER: Skip hooks
git commit --no-verify

# ❌ NEVER: Amend published commits
git commit --amend  # After push

# ❌ NEVER: Rebase public branches
git rebase main  # On shared branch
```

## Deployment Actions - NEVER DO

- Deploy without running all quality gates
- Deploy directly to production without staging
- Deploy on Friday afternoon
- Deploy without rollback plan
- Deploy secrets to public repositories

---

# 14. INCIDENT RESPONSE

## When a Bug Reaches Production

### Immediate Actions (0-15 minutes)

1. **Assess severity** - Is it data loss, security, or UX issue?
2. **Document** - Screenshot, error message, reproduction steps
3. **Decide** - Hotfix or rollback?

### Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-description

# 2. Make minimal fix
# - Only fix the bug, no other changes
# - Add test that would have caught this

# 3. Run all quality gates
npm run validate

# 4. Fast-track review and merge
git push -u origin hotfix/critical-bug-description
# Create PR, get emergency review

# 5. Deploy immediately after merge
```

### Rollback Process

```bash
# If hotfix is not feasible, rollback to last known good version
git revert HEAD
git push origin main

# Or deploy previous version tag
git checkout v1.2.2
npm run build
# Deploy this build
```

### Post-Incident (Within 24 hours)

1. **Root Cause Analysis** - Why did this happen?
2. **Process Gap** - What check would have caught this?
3. **Add Prevention** - New test, lint rule, or gate
4. **Document** - Add to project learnings

---

# APPENDIX A: Quick Reference Card

## Essential Commands

```bash
npm run validate    # Run all 4 quality gates
npm run typecheck   # TypeScript only
npm run lint        # ESLint only
npm run test        # Tests only
npm run build       # Build only
npm run lint:fix    # Auto-fix lint issues
npm run test:watch  # Watch mode for TDD
```

## Code Pattern Quick Reference

```typescript
// Null safety
const safe = value ?? defaultValue
const name = user?.profile?.name ?? 'Anonymous'

// Loading states
if (!user) { setLoading(false); return }
try { ... } finally { setLoading(false) }

// Error handling
try { await api() } catch (e) { handleError(e) }

// Arrays
const items = (data ?? []).map(...)

// Events
e.preventDefault(); e.stopPropagation()
```

## Commit Message Quick Reference

```
feat(scope): add new feature
fix(scope): fix bug description
docs(scope): update documentation
refactor(scope): restructure code
test(scope): add or update tests
chore(scope): update build/tools
```

---

**Version**: 3.0.0
**Last Updated**: 2026-01-26
**Maintainer**: Development Team

> "Quality is not an act, it is a habit." - Aristotle
