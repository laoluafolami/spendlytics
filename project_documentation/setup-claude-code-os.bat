@echo off
REM Claude Code OS - Quick Setup Script for Windows
REM Run this in the root of any TypeScript/JavaScript project

echo ==========================================
echo Claude Code OS - Setting up safeguards...
echo ==========================================

REM Check if package.json exists
if not exist "package.json" (
  echo ERROR: package.json not found. Run this from your project root.
  exit /b 1
)

REM Check if it's a git repository
if not exist ".git" (
  echo ERROR: Not a git repository. Run 'git init' first.
  exit /b 1
)

REM Create hooks directory
if not exist ".git\hooks" mkdir ".git\hooks"

REM Create pre-commit hook
echo Creating pre-commit hook...
(
echo #!/bin/sh
echo # Claude Code OS - Pre-commit hook
echo # Blocks commits if TypeScript check fails
echo.
echo echo "Running TypeScript check before commit..."
echo npm run typecheck
echo.
echo if [ $? -ne 0 ]; then
echo   echo ""
echo   echo "=========================================="
echo   echo "COMMIT BLOCKED: TypeScript errors found!"
echo   echo "Fix the errors above before committing."
echo   echo "=========================================="
echo   exit 1
echo fi
echo.
echo echo "TypeScript check passed. Proceeding with commit."
echo exit 0
) > ".git\hooks\pre-commit"

echo   Done: Pre-commit hook created

REM Remind about package.json
echo.
echo ==========================================
echo Claude Code OS setup complete!
echo ==========================================
echo.
echo IMPORTANT: Add this to your package.json scripts:
echo   "typecheck": "tsc --noEmit"
echo.
echo Next steps:
echo 1. Add typecheck script to package.json (if not already added)
echo 2. Copy CLAUDE_CODE_OS_TEMPLATE.md to CLAUDE.md in project root
echo 3. Customize CLAUDE.md for your project
echo 4. Test: make a change and try to commit
echo.
