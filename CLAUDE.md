# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

Wavelet Zone is an interactive Python learning platform for upper primary students. It uses a worksheet-based approach with problems across three difficulty levels (easy/medium/hard) to ensure all students can make progress. The platform runs Python code directly in the browser using Pyodide (WebAssembly).

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Start development server with live reload
npm run dev

# Start simple development server
npm run serve
# or
npm start
```

### Testing
```bash
# Run all tests
npm run test:all

# Run individual test suites
npm run test                    # error-handler tests
npm run test:homepage:basic     # homepage basic tests  
npm run test:validation         # validation system tests
npm run test:input-system       # input system tests
```

### Deployment
```bash
# Build for deployment (static files)
# IMPORTANT: Always run before pushing to GitHub for deployment
npm run build

# Deploy with Docker
npm run deploy:docker
```

**⚠️ GitHub Pages Deployment**: Before pushing worksheet changes to GitHub, always run `npm run build` to update the version file. This ensures localStorage is automatically cleared for users when worksheet content changes, preventing broken saved states.

## Architecture

### Core Files
- `index.html` - Main entry point and worksheet selector
- `worksheet.html` - Individual worksheet interface  
- `script.js` - Main application logic and worksheet loading
- `worksheet.js` - Worksheet-specific functionality and code execution
- `validation.js` - Answer validation and feedback system
- `input-system.js` - Textbox-based input system for interactive problems
- `error-handler.js` - Python error parsing and user-friendly messages
- `styles.css` - All CSS styling with custom properties

### Worksheet System
- `worksheets/index.json` - Master list of available worksheets
- `worksheets/worksheet-N.json` - Individual worksheet content and problems
- `worksheets/template.json` - Template for creating new worksheets

### Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Python Runtime**: Pyodide v0.28.2 (Python compiled to WebAssembly)
- **Code Editor**: CodeMirror 5.65.2
- **Math Rendering**: MathJax (for mathematical expressions)

## Key Systems

### Input System (`get_input()` function)
For interactive Python problems, students use textbox inputs instead of command-line input:
```python
# Single input (no argument needed)
number = get_input()

# Named inputs  
num1 = get_input('first_number')
num2 = get_input('second_number')
```

### Validation System
Problems are validated using pattern matching, output checking, and code analysis. See `VALIDATION.md` for detailed validation rules.

### Progress Tracking
Automatic progress persistence using localStorage. Students' code and completion status are saved per worksheet.

## Code Style Guidelines

### JavaScript
- Use ES6+ features (async/await, arrow functions, template literals)
- Prefer `const`/`let` over `var`
- Use `ErrorHandler` utility for consistent error processing
- Add JSDoc comments for complex functions
- Cache DOM elements to minimize queries

### Python Error Handling
Always reset Python environment between executions and provide educational error messages:
```javascript
try {
    await resetPythonEnvironment();
    await pyodide.runPythonAsync(code);
} catch (error) {
    const errorInfo = ErrorHandler.extractErrorInfo(error.message);
    displayOutput(output, errorInfo.fullMessage, 'error');
}
```

### CSS
- Use CSS custom properties for theming
- Follow BEM-like naming for complex components
- Mobile-first responsive design
- Modern CSS (Grid, Flexbox)


## Important Notes

- User is on Windows/WSL2 - use PowerShell-compatible commands when needed
- All Python code execution happens in browser via Pyodide
- Educational context is paramount - keep UI intuitive for beginners
- Worksheets 1-4 focus on numerical programming; strings introduced in Worksheet 5
- When creating new worksheets, follow the structure in `template.json`
- Always test worksheet problems across different difficulty levels
