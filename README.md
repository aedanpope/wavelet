# Python Learning Platform

An interactive Python learning platform designed for classroom use with structured worksheets. Students can write and run Python code directly in their browser using Pyodide (Python compiled to WebAssembly).

## Features

- **Interactive Worksheets**: Structured learning with 5-6 problems per worksheet
- **Progressive Difficulty**: Problems start easy and get progressively harder
- **Real-time Code Execution**: Run Python code instantly in the browser
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Hints System**: Helpful hints for each problem
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **No Installation Required**: Runs entirely in the browser

## Worksheet Structure

Each worksheet contains:
- **Instruction Problems**: Introduce new concepts with examples
- **Practice Problems**: Reinforce learning with guided exercises
- **Challenge Problems**: Apply knowledge to more complex scenarios
- **Points System**: Gamified learning with point-based scoring
- **Estimated Time**: Help teachers plan classroom activities

## Current Worksheets

1. **Worksheet 1: Getting Started with Print** - Learn the basics of Python's print function
2. **Worksheet 2: Variables and Basic Math** - Introduction to variables and arithmetic
3. **Worksheet 3: Getting User Input** - Interactive programs with user input

## For Teachers

### Creating New Worksheets

1. Copy the template file: `worksheets/template.json`
2. Rename it to `worksheet-X.json` (where X is the next number)
3. Fill in the worksheet content following the template structure
4. Update `worksheets/index.json` to include your new worksheet
5. Deploy the updated files

### Worksheet Data Structure

```json
{
  "id": "worksheet-id",
  "title": "Worksheet Title",
  "description": "Brief description",
  "difficulty": "beginner|intermediate|advanced",
  "estimatedTime": "20-30 minutes",
  "problems": [
    {
      "id": "1.1",
      "type": "instruction|practice|challenge",
      "title": "Problem Title",
      "content": "Explanation content (supports HTML)",
      "task": "What the student needs to do",
      "starterCode": "# Starting code for students",
      "expectedOutput": "Expected output description",
      "hint": "Helpful hint for students",
      "points": 1
    }
  ],
  "metadata": {
    "created": "YYYY-MM-DD",
    "author": "Teacher Name",
    "tags": ["tag1", "tag2"],
    "prerequisites": ["worksheet-1"]
  }
}
```

### Problem Types

- **instruction**: Introduce new concepts with examples
- **practice**: Reinforce learning with guided exercises  
- **challenge**: Apply knowledge to complex scenarios

## For Students

### Getting Started

1. Open the platform in your web browser
2. Choose a worksheet from the selection screen
3. Read the problem explanation and task
4. Write your Python code in the editor
5. Click "Run Code" to execute your program
6. Use the "Hint" button if you need help
7. Navigate between problems using the arrow buttons
8. Complete all problems to finish the worksheet

### Tips for Success

- Start with Worksheet 1 if you're new to Python
- Read the problem carefully before writing code
- Use hints when you're stuck
- Don't worry about making mistakes - that's how you learn!
- Try different approaches to solve problems

## Technical Details

### Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Code Editor**: CodeMirror 5.65.2
- **Python Runtime**: Pyodide v0.24.1 (Python compiled to WebAssembly)
- **Styling**: Custom CSS with responsive design
- **Data Format**: JSON for worksheet content

### Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### File Structure

```
├── index.html              # Main application
├── styles.css              # Application styling
├── script.js               # Application logic
├── package.json            # Project configuration
├── worksheets/             # Worksheet data
│   ├── index.json          # Worksheet index
│   ├── template.json       # Worksheet template
│   ├── worksheet-1.json    # Print basics
│   ├── worksheet-2.json    # Variables and math
│   └── worksheet-3.json    # User input
└── README.md               # This file
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or use the simple server
npm run serve
```

### Production Deployment

The application is a static web app that can be deployed to any web hosting service:

- **GitHub Pages**: Push to GitHub and enable Pages
- **Netlify**: Drag and drop the project folder
- **Vercel**: Connect GitHub repository
- **Traditional Web Server**: Copy files to web directory

### Adding New Worksheets

1. Create a new JSON file in the `worksheets/` directory
2. Follow the template structure
3. Update `worksheets/index.json` to include the new worksheet
4. Test locally before deploying
5. Deploy the updated files

## Contributing

This platform is designed for educational use. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or issues:
- Check the browser console for error messages
- Ensure you have a stable internet connection (required for Pyodide)
- Try refreshing the page if the application doesn't load
- Contact the development team for technical support

---

**Happy Coding! 🐍**
