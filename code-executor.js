// Code execution engine for the Python learning platform
// Handles Pyodide initialization, code running, input system setup, and error handling

/**
 * Code execution engine class
 * Manages all aspects of running Python code in the browser
 */
class CodeExecutor {
    constructor() {
        this.pyodide = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Pyodide environment
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Load Pyodide with environment-specific configuration
            if (typeof module !== 'undefined' && module.exports) {
                // Node.js environment (testing)
                const { loadPyodide } = require('pyodide');
                this.pyodide = await loadPyodide({
                    indexURL: "./node_modules/pyodide/"
                });
            } else {
                // Browser environment (production)
                this.pyodide = await loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
                });
            }
            
            this.isInitialized = true;
            console.log('Pyodide initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Pyodide:', error);
            throw new Error('Failed to initialize Python environment. Please refresh the page and try again.');
        }
    }

    /**
     * Execute Python code with output capture
     * @param {string} code - Python code to execute
     * @param {HTMLElement} outputElement - Output element to display results
     * @param {number} problemIndex - Index of the problem (for canvas support)
     * @returns {Promise<Object>} Execution result with captured output
     */
    async executeCode(code, outputElement, problemIndex = 0) {
        let printOutput = '';
        outputElement.innerHTML = ''; // Clear previous output

        // Create a text container for print output
        const textContainer = document.createElement('div');
        textContainer.className = 'output-text';
        outputElement.appendChild(textContainer);

        // Capture print output incrementally
        const originalPrint = this.pyodide.globals.get('print');
        this.pyodide.globals.set('print', function(...args) {
            const text = args.join(' ');
            textContainer.textContent += text + '\n';
            printOutput += text + '\n';
        });

        try {
            await this.pyodide.runPythonAsync(code);
        } finally {
            // Restore original print function
            this.pyodide.globals.set('print', originalPrint);

            // Auto-flush canvas if canvas system is available
            if (typeof autoFlushCanvas !== 'undefined') {
                autoFlushCanvas(this.pyodide, problemIndex);
            }
        }

        return { printOutput };
    }


    /**
     * Reset Python environment to clear all variables and state
     * @param {number} problemIndex - Index of the problem (for canvas reset)
     */
    async resetPythonEnvironment(problemIndex = 0) {
        try {
            // Use a much simpler approach that's more compatible with Pyodide
            await this.pyodide.runPythonAsync(`
# Simple environment reset - just clear user-defined variables
try:
    # Get current globals
    current_globals = list(globals().keys())

    # Define built-in names that should be preserved
    builtin_names = {
        '__builtins__', '__name__', '__doc__', '__package__', '__loader__',
        '__spec__', '__annotations__', '__all__', '__file__', '__cached__',
        'print', 'input', 'len', 'str', 'int', 'float', 'list', 'dict', 'tuple',
        'set', 'bool', 'type', 'range', 'enumerate', 'zip', 'map', 'filter',
        'sum', 'min', 'max', 'abs', 'round', 'pow', 'divmod', 'bin', 'oct', 'hex',
        'chr', 'ord', 'ascii', 'repr', 'eval', 'exec', 'compile', 'open',
        'help', 'dir', 'vars', 'getattr', 'setattr', 'hasattr', 'delattr',
        'isinstance', 'issubclass', 'super', 'property', 'staticmethod', 'classmethod',
        'all', 'any', 'next', 'iter', 'reversed', 'sorted', 'hash', 'id',
        'callable', 'format', 'breakpoint', 'copyright', 'credits', 'license',
        'exit', 'quit', 'True', 'False', 'None', 'NotImplemented', 'Ellipsis',
        'Exception', 'BaseException', 'StopIteration', 'GeneratorExit',
        'ArithmeticError', 'BufferError', 'LookupError', 'AssertionError',
        'AttributeError', 'EOFError', 'FloatingPointError', 'OSError',
        'ImportError', 'ModuleNotFoundError', 'IndexError', 'KeyError',
        'KeyboardInterrupt', 'MemoryError', 'NameError', 'OverflowError',
        'RecursionError', 'ReferenceError', 'RuntimeError', 'SyntaxError',
        'IndentationError', 'TabError', 'SystemError', 'TypeError',
        'UnboundLocalError', 'UnicodeError', 'UnicodeEncodeError',
        'UnicodeDecodeError', 'UnicodeTranslateError', 'ValueError',
        'ZeroDivisionError', 'BlockingIOError', 'BrokenPipeError',
        'ChildProcessError', 'ConnectionError', 'BrokenPipeError',
        'ConnectionAbortedError', 'ConnectionRefusedError', 'ConnectionResetError',
        'FileExistsError', 'FileNotFoundError', 'InterruptedError',
        'IsADirectoryError', 'NotADirectoryError', 'PermissionError',
        'ProcessLookupError', 'TimeoutError', 'Warning', 'UserWarning',
        'DeprecationWarning', 'PendingDeprecationWarning', 'SyntaxWarning',
        'RuntimeWarning', 'FutureWarning', 'ImportWarning', 'UnicodeWarning',
        'BytesWarning', 'ResourceWarning'
    }

    # Remove user-defined variables (those not in builtin_names and not starting with '_')
    for var_name in current_globals:
        if var_name not in builtin_names and not var_name.startswith('_'):
            try:
                del globals()[var_name]
            except:
                pass

except Exception as e:
    # If anything goes wrong, just continue
    pass
`);
        } catch (error) {
            console.warn('Error resetting Python environment:', error);
            // Continue anyway - the environment will be mostly clean
        }

        // Reset canvas state if canvas system is available
        if (typeof resetCanvasState !== 'undefined') {
            resetCanvasState(problemIndex);
        }
    }

    /**
     * Process code to handle async functions like get_choice
     * @param {string} code - Original Python code
     * @returns {string} Processed code with await statements
     */
    processCodeForAsync(code) {
        // Use a regular expression to find calls to get_choice and wrap them in await
        // This is a hack to get the get_choice function to work without students having to write 'await'
        // TODO: Use an AST based solution instead.
        // Only add 'await' if it's not already present
        return code.replace(/(?<!await\s+)get_choice\((.*?)\)/g, 'await get_choice($1)');
    }

    /**
     * Get the Pyodide instance
     * @returns {Object} Pyodide instance
     */
    getPyodide() {
        return this.pyodide;
    }

    /**
     * Check if Pyodide is initialized
     * @returns {boolean} True if initialized
     */
    isReady() {
        return this.isInitialized && this.pyodide !== null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment (for testing)
    module.exports = { CodeExecutor };
} else {
    // Browser environment
    window.CodeExecutor = CodeExecutor;
}
