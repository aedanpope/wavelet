# Development Guide

## Development Environment

This project is configured to run in **WSL2 (Windows Subsystem for Linux)** with Ubuntu. The npm configuration uses bash instead of PowerShell for cross-platform compatibility.

### Recommended Setup
- **OS**: WSL2 with Ubuntu (or native Linux)
- **Development Tool**: Claude Code from the command line in Ubuntu/WSL2
- **Node.js**: v18+ (tested with v22.19.0)
- **npm**: v10+ (tested with v10.9.3)

### Why WSL2?
The project's `.npmrc` is configured for bash shell execution, making it ideal for Linux environments. While it can run on Windows, WSL2 provides the optimal development experience.

## Local Development

### Setup
```bash
# Install dependencies
npm install
```

### Running Locally
```bash
# Start development server
npm run dev

# Or use the simple server
npm run serve

# Alternative command
npm start
```

## Deployment

The application is a static web app deployable to any web hosting service:

- **GitHub Pages**: Push to GitHub and enable Pages
- **Netlify**: Drag and drop the project folder
- **Vercel**: Connect GitHub repository
- **Traditional Web Server**: Copy files to web directory

## Quick Commands

### Submit changes to github
```bash
# Use Claude Code from WSL2/Ubuntu command line
git add .
git commit -m "Your commit message"
git push
```

### Run tests
```bash
npm run test:all
```