#!/bin/bash
#
# Quality Gates Setup Script
# Run this in any TypeScript/React project root to set up the full framework
#
# Usage: bash setup-quality-gates.sh
#

set -e

echo ""
echo "============================================================"
echo "   Quality Gates Framework - Automated Setup"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Install dependencies
echo -e "${YELLOW}[1/6] Installing dependencies...${NC}"
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks
echo -e "${GREEN}Done${NC}"
echo ""

# Step 2: Add npm scripts
echo -e "${YELLOW}[2/6] Adding npm scripts...${NC}"
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.lint="eslint src"
npm pkg set scripts.lint:strict="eslint src --max-warnings 0"
npm pkg set scripts.lint:fix="eslint src --fix"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.test:coverage="vitest run --coverage"
npm pkg set scripts.validate="npm run typecheck && npm run lint && npm run test && npm run build"
echo -e "${GREEN}Done${NC}"
echo ""

# Step 3: Create vitest.config.ts
echo -e "${YELLOW}[3/6] Creating vitest.config.ts...${NC}"
cat > vitest.config.ts << 'EOF'
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
EOF
echo -e "${GREEN}Done${NC}"
echo ""

# Step 4: Create test setup
echo -e "${YELLOW}[4/6] Creating test setup...${NC}"
mkdir -p src/test
cat > src/test/setup.ts << 'EOF'
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
EOF

# Create sample test
cat > src/test/infrastructure.test.ts << 'EOF'
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
EOF
echo -e "${GREEN}Done${NC}"
echo ""

# Step 5: Create ESLint config
echo -e "${YELLOW}[5/6] Creating eslint.config.js...${NC}"
cat > eslint.config.js << 'EOF'
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
EOF
echo -e "${GREEN}Done${NC}"
echo ""

# Step 6: Create GitHub Actions workflow
echo -e "${YELLOW}[6/6] Creating CI workflow...${NC}"
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
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
EOF
echo -e "${GREEN}Done${NC}"
echo ""

# Step 7: Create pre-commit hook
echo -e "${YELLOW}[Bonus] Creating pre-commit hook...${NC}"
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'EOF'
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
EOF
chmod +x .git/hooks/pre-commit
echo -e "${GREEN}Done${NC}"
echo ""

# Final verification
echo "============================================================"
echo "   Setup Complete! Running validation..."
echo "============================================================"
echo ""
npm run validate

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}   SUCCESS! Quality Gates Framework is ready.${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Copy CLAUDE_MD_TEMPLATE.md to ./CLAUDE.md"
echo "  2. Commit the new configuration files"
echo "  3. All future commits will be validated automatically"
echo ""
