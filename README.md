# Wavelet Zone - Interactive Python Learning Platform

**Wavelet Zone** is an innovative web-based Python learning platform designed specifically for upper primary students. The platform uses a unique "worksheet" approach with carefully balanced problem difficulty levels to ensure all students can make meaningful progress in their programming journey.

🌐 **Live App**: [https://wavelet.zone/](https://wavelet.zone/)

## About Wavelet Zone

Wavelet Zone provides a comprehensive Python learning experience through interactive worksheets and real-time code execution. Our platform makes learning Python accessible, engaging, and effective for students of all skill levels.

## Key Features

- **Worksheet-Based Learning**: 5 structured worksheets with ~20 problems each across three difficulty levels
- **Numerical Programming Foundation**: Worksheets 1-4 focus on core programming concepts without string complexity
- **Interactive Code Execution**: Run Python code instantly in the browser using Pyodide
- **Visual Input System**: User-friendly textbox inputs instead of intimidating command line prompts
- **Real-time Validation**: Immediate feedback with educational error messages
- **Progress Tracking**: Visual indicators and completion tracking
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Educational Approach

The Wavelet Zone platform addresses key limitations of traditional programming courses:
- **Multiple Practice Opportunities**: Unlike single-concept repetition
- **Non-Linear Learning**: Students can work on different difficulty levels within the same worksheet
- **Always Accessible**: Students always have problems they can solve, preventing frustration
- **Immediate Results**: Students always run working code, never spend entire lessons stuck

## Learning Progression

The Wavelet Zone curriculum follows a carefully designed progression where Worksheets 1-4 focus exclusively on numerical programming without string complexity, allowing students to build solid fundamentals while creating engaging interactive programs. Only after mastering core concepts do students encounter strings in Worksheet 5, introduced in a simplified manner that avoids common pitfalls and unnecessary complexity.

For detailed descriptions of each worksheet, see [WORKSHEETS.md](WORKSHEETS.md).

## Quick Start

### For Students
1. Open Wavelet Zone in your web browser [https://wavelet.zone/](https://wavelet.zone/)
2. Choose a worksheet from the selection screen
3. Read the problem explanation and task
4. Write your Python code in the editor
5. Click "Run Code" to execute your program
6. Use the "Hint" button if you need help
7. Navigate between problems using the arrow buttons

### For Teachers
1. Copy `worksheets/template.json` to create new worksheets
2. Follow the structure in [VALIDATION.md](VALIDATION.md) for validation rules
3. Update `worksheets/index.json` to include new worksheets
4. Test locally before deploying

## Documentation

- **[DESIGN.md](DESIGN.md)** - Detailed design decisions and technical requirements
- **[WORKSHEETS.md](WORKSHEETS.md)** - Complete worksheet descriptions and learning objectives
- **[VALIDATION.md](VALIDATION.md)** - Validation system documentation and examples
- **[DEV.md](DEV.md)** - Development setup and technical details
- **[TESTING.md](TESTING.md)** - Testing procedures and guidelines

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Code Editor**: CodeMirror 5.65.2
- **Python Runtime**: Pyodide v0.24.1 (Python compiled to WebAssembly)
- **Data Format**: JSON for worksheet content

## Development

For local development setup, deployment instructions, and technical details, see [DEV.md](DEV.md).

## Contributing

This platform is designed for educational use. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (see [TESTING.md](TESTING.md))
5. Submit a pull request

## License

This software is for personal use only and is not to be copied, modified, or distributed without the explicit permission of the author. All rights reserved. See LICENSE file for details.

---

**Happy Coding! 🐍**

*Wavelet Zone - Making Python Learning Accessible and Engaging*
