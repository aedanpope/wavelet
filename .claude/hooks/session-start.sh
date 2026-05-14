#!/bin/bash
set -euo pipefail

# Only install in remote Claude Code sandboxes. On the user's local
# machine, scripts/post-commit (node version) is installed via
# `npm run setup` and runs scripts/generate-version.js.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
HOOK_PATH="$REPO_ROOT/.git/hooks/post-commit"

mkdir -p "$REPO_ROOT/.git/hooks"

cat > "$HOOK_PATH" << 'HOOK_EOF'
#!/bin/bash
# Auto-installed by .claude/hooks/session-start.sh for sandboxes
# without node. Mirrors scripts/post-commit (which uses node) by
# stamping version.js with the current commit hash so the browser
# localStorage cache for worksheet content is invalidated.

if [ "${WAVELET_AMENDING_VERSION:-}" = "1" ]; then
  exit 0
fi

COMMIT_HASH=$(git rev-parse HEAD)
printf "window.APP_VERSION = '%s';\n" "$COMMIT_HASH" > version.js

git add version.js
if ! git diff --cached --quiet -- version.js; then
  WAVELET_AMENDING_VERSION=1 git commit --amend --no-edit
fi
HOOK_EOF

chmod +x "$HOOK_PATH"
echo "Installed post-commit hook at $HOOK_PATH"
