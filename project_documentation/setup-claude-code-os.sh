#!/bin/bash
# Claude Code OS - Quick Setup Script
# Run this in the root of any TypeScript/JavaScript project

echo "=========================================="
echo "Claude Code OS - Setting up safeguards..."
echo "=========================================="

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "ERROR: package.json not found. Run this from your project root."
  exit 1
fi

# Check if it's a git repository
if [ ! -d ".git" ]; then
  echo "ERROR: Not a git repository. Run 'git init' first."
  exit 1
fi

# Add typecheck script to package.json if not exists
if ! grep -q '"typecheck"' package.json; then
  echo "Adding typecheck script to package.json..."
  # Using node to safely modify JSON
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (!pkg.scripts) pkg.scripts = {};
    if (!pkg.scripts.typecheck) {
      pkg.scripts.typecheck = 'tsc --noEmit';
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
      console.log('  ✓ Added typecheck script');
    } else {
      console.log('  ✓ typecheck script already exists');
    }
  "
else
  echo "  ✓ typecheck script already exists"
fi

# Create pre-commit hook
echo "Creating pre-commit hook..."
mkdir -p .git/hooks

cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/sh
# Claude Code OS - Pre-commit hook
# Blocks commits if TypeScript check fails

echo "Running TypeScript check before commit..."
npm run typecheck

if [ $? -ne 0 ]; then
  echo ""
  echo "=========================================="
  echo "COMMIT BLOCKED: TypeScript errors found!"
  echo "Fix the errors above before committing."
  echo "=========================================="
  exit 1
fi

echo "✓ TypeScript check passed. Proceeding with commit."
exit 0
HOOK

chmod +x .git/hooks/pre-commit
echo "  ✓ Pre-commit hook created"

# Copy CLAUDE.md template if it doesn't exist
if [ ! -f "CLAUDE.md" ]; then
  if [ -f "project_documentation/CLAUDE_CODE_OS_TEMPLATE.md" ]; then
    echo "Creating CLAUDE.md from template..."
    cp project_documentation/CLAUDE_CODE_OS_TEMPLATE.md CLAUDE.md
    echo "  ✓ CLAUDE.md created (customize the PROJECT_NAME and tech stack)"
  else
    echo "  ! CLAUDE.md template not found. Create manually."
  fi
else
  echo "  ✓ CLAUDE.md already exists"
fi

echo ""
echo "=========================================="
echo "Claude Code OS setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit CLAUDE.md to customize for your project"
echo "2. Test the hook: make a change and try to commit"
echo "3. If TypeScript fails, the commit will be blocked"
echo ""
echo "Commands:"
echo "  npm run typecheck  - Run TypeScript validation"
echo ""
