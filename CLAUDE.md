# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ MANDATORY TASK PLANNING REQUIREMENT ⚠️

**BEFORE STARTING ANY FIX, ENHANCEMENT, OR DEVELOPMENT TASK, CLAUDE MUST:**

1. **Create a task plan file** named `tasks/TASK_N.md` where N is an incrementing number (starting from 0). Run `ls tasks` first to see what to use for N.
2. **Propose a detailed plan** that includes:
   - Problem analysis and root cause identification (for fixes) OR feature requirements and user value (for new capabilities)
   - Step-by-step implementation approach
   - Files that will be modified or created
   - Testing strategy
   - Potential risks or considerations
3. **Review the plan with the `arch` agent** to ensure strategic design alignment.
4. Update the TASK_N document to incorporate the feedback from `arch`, and append revision notes at the bottom of the doc with the feedback from `arch` & a log of the corresponding changes made.
4. **Wait for user approval** before proceeding with implementation

**TASK FILE COMPLETENESS REQUIREMENTS:**

Each TASK_N.md must enable a fresh agent session to implement without additional research:

1. **Complete Context**
   - **For fixes**: Current broken/suboptimal behavior with specific examples, user impact, root cause analysis with key code locations (file:line)
   - **For features**: User requirements, business/educational value, acceptance criteria, integration with existing workflows

2. **Implementation Scope**
   - Key files and functions that need modification
   - New components/files that need creation
   - Configuration or data structure changes
   - Integration points with existing systems

3. **Testing Strategy**
   - New unit test cases to be written (with TDD where appropriate)
   - Existing tests that need updates
   - Integration/end-to-end test requirements
   - User acceptance criteria for manual testing

4. **Success Criteria & Risks**
   - Clear definition of "done"
   - Potential side effects and mitigation strategies
   - Rollback considerations

The doc should be written in such a way that a new agent session with /clear could read the doc and pick up the task.

### Task File Naming Convention
- First task: `TASK_0.md`
- Second task: `TASK_1.md` 
- And so on...

**This ensures clear communication and prevents unnecessary work on incorrect approaches.**

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
npm run build

# Deploy with Docker
npm run deploy:docker
```

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

## Critical Workflow Reminders

**⚠️ STOP BEFORE IMPLEMENTING**: If you are starting ANY implementation, enhancement, bug fix, or development task WITHOUT first creating a TASK_N.md file, STOP IMMEDIATELY and create the required task plan file first. This is MANDATORY per the project guidelines above.