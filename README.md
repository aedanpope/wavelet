# Python Browser Editor

A modern web application that allows users to write and run Python code directly in the browser using Pyodide. This is a client-side only application - all Python code execution happens in your browser, no server required!

## Features

- 🐍 **Full Python Support**: Run Python 3.9+ code with Pyodide
- 📝 **Syntax Highlighting**: Beautiful code editor with Python syntax highlighting
- 🎨 **Modern UI**: Clean, responsive design that works on desktop and mobile
- 📦 **Popular Libraries**: Built-in support for NumPy and Matplotlib
- 📚 **Code Examples**: Pre-built examples to help you get started
- ⌨️ **Keyboard Shortcuts**: Ctrl+Enter to run code quickly
- 📱 **Responsive Design**: Works perfectly on all device sizes

## Getting Started

### Option 1: Open Directly in Browser
Simply open `index.html` in your web browser. The app will automatically load Pyodide and be ready to use.

### Option 2: Local Server (Recommended)
For the best experience, serve the files using a local web server:

```bash
# Using Python 3
python -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## How to Use

1. **Write Code**: Type your Python code in the left editor panel
2. **Run Code**: Click the "Run Code" button or press Ctrl+Enter
3. **View Output**: See the results in the right output panel
4. **Try Examples**: Click "Examples" to load pre-built code samples
5. **Clear**: Use the clear buttons to reset the editor or output

## Available Examples

- **Hello World**: Simple print statements
- **Basic Math**: Mathematical operations and calculations
- **Loops & Lists**: Working with loops, lists, and list comprehensions
- **Functions**: Defining and calling functions
- **Matplotlib**: Creating plots and visualizations

## Supported Libraries

The app comes with these popular Python libraries pre-loaded:

- **NumPy**: For numerical computing
- **Matplotlib**: For creating plots and visualizations
- **Standard Library**: All Python standard library modules

## Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Code Editor**: CodeMirror with Python syntax highlighting
- **Python Runtime**: Pyodide (Python compiled to WebAssembly)
- **Styling**: Custom CSS with modern design principles

### Browser Compatibility
- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Performance
- Initial load time: ~10-15 seconds (Pyodide download)
- Code execution: Near-native speed
- Memory usage: ~50-100MB for basic operations

## Limitations

- **Initial Load**: Pyodide is ~40MB and takes time to download on first use
- **Limited Libraries**: Only pre-loaded packages are available (NumPy, Matplotlib)
- **No File I/O**: Cannot read/write files on your system
- **No Network**: Cannot make HTTP requests (by default)
- **Memory**: Large computations may be limited by browser memory

## Customization

### Adding More Examples
Edit the `examples` object in `script.js` to add your own code examples:

```javascript
const examples = {
    // ... existing examples ...
    myExample: `# My custom example
print("Hello from my example!")
# Add your code here
`
};
```

### Changing the Theme
The editor uses the Monokai theme by default. You can change it by modifying the CodeMirror initialization in `script.js`:

```javascript
editor = CodeMirror(document.getElementById('editor'), {
    // ... other options ...
    theme: 'your-preferred-theme', // Change this line
    // ... other options ...
});
```

### Styling
All styles are in `styles.css`. The app uses CSS Grid for layout and CSS custom properties for theming.

## Troubleshooting

### Pyodide Won't Load
- Check your internet connection
- Try refreshing the page
- Ensure you're using a supported browser
- Check browser console for error messages

### Code Won't Run
- Make sure Pyodide has finished loading
- Check for syntax errors in your Python code
- Ensure you're not using unsupported libraries

### Performance Issues
- Close other browser tabs to free up memory
- Avoid infinite loops in your code
- Large computations may take time or fail

## Contributing

Feel free to contribute to this project by:
- Adding new examples
- Improving the UI/UX
- Adding support for more libraries
- Fixing bugs
- Improving documentation

## License

This project is open source and available under the MIT License.

## Acknowledgments

- [Pyodide](https://pyodide.org/) - Python in the browser
- [CodeMirror](https://codemirror.net/) - Code editor component
- [Matplotlib](https://matplotlib.org/) - Plotting library
- [NumPy](https://numpy.org/) - Numerical computing library
