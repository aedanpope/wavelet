# Development Guide

## Development Environment

This project requires **bash** for npm scripts (configured in `.npmrc`). On Windows, use **Git Bash** as your terminal.

### Recommended Setup
- **Terminal**: Git Bash (bundled with [Git for Windows](https://git-scm.com/downloads))
- **IDE**: VS Code with Git Bash as the integrated terminal
- **Node.js**: v18+ (tested with v22.19.0)
- **npm**: v10+ (tested with v10.9.3)

### VS Code Terminal Setup (Windows)

Set VS Code's integrated terminal to Git Bash:
1. Open Command Palette (`Ctrl+Shift+P`)
2. Search for **Terminal: Select Default Profile**
3. Choose **Git Bash**

Without this, `npm run dev` will fail with a `spawn /bin/bash ENOENT` error in PowerShell or cmd.exe.

### Claude Code Memory

Claude's memory is stored locally at `C:\Users\<you>\.claude\projects\...\memory\` and is **not** backed up to git. It will be lost on a fresh Windows install. Ideally this gets solved properly later (e.g. via symlink or a Claude Code config option).

### Fresh Windows Install — First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
```

The dev server runs at **http://localhost:8000** with live reload.

> **Note**: `npm run dev` must be run from Git Bash (or any bash-compatible shell). The project's `.npmrc` sets `script-shell` to the Git Bash executable. If you get a `spawn /bin/bash ENOENT` error, check that your terminal is Git Bash, not PowerShell or cmd.

## Local Development

### Running Locally
```bash
# Start development server with live reload
npm run dev

# Or use the simple server (no live reload)
npm run serve

# Alternative
npm start
```

## Deployment

The application is a static web app deployable to any web hosting service:

- **GitHub Pages**: Push to GitHub and enable Pages
- **Netlify**: Drag and drop the project folder
- **Vercel**: Connect GitHub repository
- **Traditional Web Server**: Copy files to web directory

## Quick Commands

### Submit changes to GitHub
```bash
# IMPORTANT: Before pushing worksheet changes, run build to update version
npm run build

git add .
git commit -m "Your commit message"
git push
```

**⚠️ Critical for GitHub Pages**: Always run `npm run build` before pushing worksheet content changes. This updates the version file which automatically clears users' localStorage when they visit the updated site, preventing broken saved states.

### Run tests
```bash
npm run test:all
```