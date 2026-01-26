# Quality Gates Setup Script for Windows PowerShell
# Run this in any TypeScript/React project root to set up the full framework
#
# Usage: .\setup-quality-gates.ps1
#

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Quality Gates Framework - Automated Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install dependencies
Write-Host "[1/6] Installing dependencies..." -ForegroundColor Yellow
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# Step 2: Add npm scripts
Write-Host "[2/6] Adding npm scripts..." -ForegroundColor Yellow
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.lint="eslint src"
npm pkg set scripts.lint:strict="eslint src --max-warnings 0"
npm pkg set scripts.lint:fix="eslint src --fix"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.test:coverage="vitest run --coverage"
npm pkg set scripts.validate="npm run typecheck && npm run lint && npm run test && npm run build"
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# Step 3: Create vitest.config.ts
Write-Host "[3/6] Creating vitest.config.ts..." -ForegroundColor Yellow
$vitestConfig = @'
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
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*'],
    },
  },
})
'@
$vitestConfig | Out-File -FilePath "vitest.config.ts" -Encoding utf8
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# Step 4: Create test setup
Write-Host "[4/6] Creating test setup..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "src/test" | Out-Null

$testSetup = @'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

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

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
'@
$testSetup | Out-File -FilePath "src/test/setup.ts" -Encoding utf8

$sampleTest = @'
import { describe, it, expect } from 'vitest'

describe('Test Infrastructure', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true)
  })
})

describe('Null Safety Patterns', () => {
  it('handles null with fallback', () => {
    const settings = null
    const safe = settings ?? { enabled: false }
    expect(safe.enabled).toBe(false)
  })

  it('handles undefined properties', () => {
    const user: { name?: string } = {}
    const name = user.name ?? 'Anonymous'
    expect(name).toBe('Anonymous')
  })
})

describe('Loading State Patterns', () => {
  it('resolves loading on early return', async () => {
    let loading = true
    const load = async (hasUser: boolean) => {
      if (!hasUser) { loading = false; return }
      loading = false
    }
    await load(false)
    expect(loading).toBe(false)
  })
})

describe('Array Safety Patterns', () => {
  it('handles null arrays', () => {
    const data = null
    const items = (data ?? []).map((x: number) => x * 2)
    expect(items).toEqual([])
  })
})
'@
$sampleTest | Out-File -FilePath "src/test/infrastructure.test.ts" -Encoding utf8
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# Step 5: Create ESLint config
Write-Host "[5/6] Creating eslint.config.js..." -ForegroundColor Yellow
$eslintConfig = @'
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
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        crypto: 'readonly',
        indexedDB: 'readonly',
        caches: 'readonly',
        Notification: 'readonly',
        ServiceWorker: 'readonly',
        ServiceWorkerRegistration: 'readonly',
        BroadcastChannel: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        Image: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        structuredClone: 'readonly',
        process: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'always'],
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-case-declarations': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts', 'public/**'],
  },
]
'@
$eslintConfig | Out-File -FilePath "eslint.config.js" -Encoding utf8
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# Step 6: Create GitHub Actions workflow
Write-Host "[6/6] Creating CI workflow..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path ".github/workflows" | Out-Null

$ciWorkflow = @'
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
        run: npm run typecheck

      - name: Gate 2 - ESLint Check
        run: npm run lint

      - name: Gate 3 - Unit Tests
        run: npm run test

      - name: Gate 4 - Production Build
        run: npm run build

      - name: All Gates Passed
        run: echo "All quality gates passed!"
'@
$ciWorkflow | Out-File -FilePath ".github/workflows/ci.yml" -Encoding utf8
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# Step 7: Create pre-commit hook
Write-Host "[Bonus] Creating pre-commit hook..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path ".git/hooks" | Out-Null

$preCommit = @'
#!/bin/sh
echo ""
echo "============================================================"
echo "       QUALITY GATES - Pre-commit Validation"
echo "============================================================"
echo ""

FAILED=0

echo "[Gate 1/4] TypeScript Compilation..."
npm run typecheck > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "FAILED: TypeScript errors found"
  npm run typecheck
  FAILED=1
else
  echo "PASSED: TypeScript"
fi

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

if [ $FAILED -ne 0 ]; then
  echo "============================================================"
  echo "  COMMIT BLOCKED - Quality gate(s) failed"
  echo "============================================================"
  echo ""
  exit 1
else
  echo "============================================================"
  echo "  ALL GATES PASSED - Commit approved"
  echo "============================================================"
  echo ""
  exit 0
fi
'@
$preCommit | Out-File -FilePath ".git/hooks/pre-commit" -Encoding utf8 -NoNewline
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# Final verification
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Setup Complete! Running validation..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

npm run validate

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "   SUCCESS! Quality Gates Framework is ready." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Copy CLAUDE_MD_TEMPLATE.md to ./CLAUDE.md"
Write-Host "  2. Commit the new configuration files"
Write-Host "  3. All future commits will be validated automatically"
Write-Host ""
