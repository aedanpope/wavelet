// Global variables
let pyodide = null;
let currentWorksheet = null;
let codeEditors = []; // Array to hold multiple code editors
let worksheets = [];
let completedProblems = new Set();

// Initialize the application
async function init() {
    try {
        // Load worksheets index
        await loadWorksheets();
        
        // Initialize Pyodide
        await initPyodide();
        
        // Show worksheet selection
        showWorksheetSelection();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please refresh the page.');
    }
}

// Load worksheets from the index file
async function loadWorksheets() {
    try {
        const response = await fetch('worksheets/index.json?t=' + Date.now());
        const data = await response.json();
        worksheets = data.worksheets;
    } catch (error) {
        console.error('Error loading worksheets:', error);
        throw new Error('Failed to load worksheets');
    }
}

// Initialize Pyodide
async function initPyodide() {
    try {
        pyodide = await loadPyodide();
        console.log('Pyodide loaded successfully');
    } catch (error) {
        console.error('Error loading Pyodide:', error);
        throw new Error('Failed to load Python runtime');
    }
}

// Show worksheet selection screen
function showWorksheetSelection() {
    document.getElementById('worksheet-selection').style.display = 'block';
    document.getElementById('worksheet-interface').style.display = 'none';
    
    const grid = document.getElementById('worksheets-grid');
    grid.innerHTML = '';
    
    worksheets.forEach(worksheet => {
        const card = createWorksheetCard(worksheet);
        grid.appendChild(card);
    });
}

// Create a worksheet card
function createWorksheetCard(worksheet) {
    const card = document.createElement('div');
    card.className = 'worksheet-card';
    card.onclick = () => loadWorksheet(worksheet.id);
    
    card.innerHTML = `
        <h3>${worksheet.title}</h3>
        <p>${worksheet.description}</p>
    `;
    
    return card;
}

// Load a specific worksheet
async function loadWorksheet(worksheetId) {
    try {
        const worksheet = worksheets.find(w => w.id === worksheetId);
        if (!worksheet) {
            throw new Error('Worksheet not found');
        }
        
        // Load worksheet data
        const response = await fetch(`worksheets/${worksheet.file}?t=${Date.now()}`);
        currentWorksheet = await response.json();
        
        // Reset progress
        completedProblems.clear();
        
        // Show worksheet interface
        showWorksheetInterface();
        
    } catch (error) {
        console.error('Error loading worksheet:', error);
        showError('Failed to load worksheet. Please try again.');
    }
}

// Show worksheet interface
function showWorksheetInterface() {
    document.getElementById('worksheet-selection').style.display = 'none';
    document.getElementById('worksheet-interface').style.display = 'block';
    
    // Update worksheet info
    document.getElementById('worksheet-title').textContent = currentWorksheet.title;
    document.getElementById('worksheet-description').textContent = currentWorksheet.description;
    
    // Load all problems
    loadAllProblems();
}

// Load all problems at once
function loadAllProblems() {
    const container = document.getElementById('problems-container');
    container.innerHTML = '';
    codeEditors = [];
    
    currentWorksheet.problems.forEach((problem, index) => {
        const problemElement = createProblemElement(problem, index);
        container.appendChild(problemElement);
    });
    
    // Initialize all code editors after DOM is ready
    setTimeout(() => {
        initAllCodeEditors();
        
        // Render LaTeX content in all problem elements
        currentWorksheet.problems.forEach((problem, index) => {
            const problemElement = document.getElementById(`problem-${index}`);
            if (problemElement) {
                renderLatexInElement(problemElement);
            }
        });
    }, 100);
}

// Create a problem element
function createProblemElement(problem, index) {
    const problemDiv = document.createElement('div');
    problemDiv.className = 'problem-container';
    problemDiv.id = `problem-${index}`;
    
    problemDiv.innerHTML = `
        <div class="problem-header">
            <h2>Problem ${index + 1}: ${problem.title}</h2>
        </div>

        <div class="problem-content">
            <div class="explanation">
                <div class="problem-content-text">${problem.content}</div>
                <div class="task-box">
                    <h4>Your Task:</h4>
                    <p>${problem.task}</p>
                </div>
            </div>

            <div class="code-section">
                <div class="code-header">
                    <h4>Your Code</h4>
                    <div class="code-controls">
                        <button class="hint-btn" onclick="showHint(${index})">💡 Hint</button>
                        <button class="run-btn" onclick="runCode(${index})">▶ Run Code</button>
                    </div>
                </div>
                <div class="code-editor" id="code-editor-${index}"></div>
                <div class="output-section">
                    <div class="output-header">Output</div>
                    <div class="output" id="output-${index}"></div>
                </div>
            </div>
        </div>
    `;
    
    return problemDiv;
}

// Render LaTeX content in a problem element
function renderLatexInElement(element) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([element]).catch((err) => {
            console.warn('MathJax rendering error:', err);
        });
    }
}

// Initialize all CodeMirror editors
function initAllCodeEditors() {
    currentWorksheet.problems.forEach((problem, index) => {
        const editorElement = document.getElementById(`code-editor-${index}`);
        const editor = CodeMirror(editorElement, {
            mode: 'python',
            theme: 'monokai',
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            extraKeys: {
                "Tab": function(cm) {
                    cm.replaceSelection("    ", "end");
                }
            }
        });
        
        // Set starter code
        editor.setValue(problem.starterCode || '');
        codeEditors[index] = editor;
    });
}

// Run Python code for a specific problem
async function runCode(problemIndex) {
    const code = codeEditors[problemIndex].getValue();
    const output = document.getElementById(`output-${problemIndex}`);
    const problem = currentWorksheet.problems[problemIndex];
    
    if (!code.trim()) {
        displayOutput(output, 'Please enter some code to run.', 'error');
        return;
    }
    
    try {
        // Show running state
        displayOutput(output, '', 'running');
        
        // Reset Python environment to clear previous state
        await resetPythonEnvironment();
        
        // Capture print output
        let printOutput = '';
        const originalPrint = pyodide.globals.get('print');
        
        pyodide.globals.set('print', function(...args) {
            printOutput += args.join(' ') + '\n';
        });
        
        // Run the code
        await pyodide.runPythonAsync(code);
        
        // Restore original print
        pyodide.globals.set('print', originalPrint);
        
        // Validate the answer
        const isValid = Validation.validateAnswer(code, printOutput, problem);
        
        if (isValid) {
            // Display output with success message
            displayOutput(output, printOutput, 'success', '✅ Correct! Well done!');
            
            // Mark as completed
            completedProblems.add(problemIndex);
            updateProgress();
            
            // Check if worksheet is complete
            if (completedProblems.size === currentWorksheet.problems.length) {
                setTimeout(showCompletionModal, 1000);
            }
        } else {
            // Show feedback for incorrect answer
            displayOutput(output, printOutput, 'error', '❌ Not quite right! Check the task requirements and try again.');
        }
        
    } catch (error) {
        // Use the shared error handling logic
        const errorInfo = ErrorHandler.extractErrorInfo(error.message);
        displayOutput(output, errorInfo.fullMessage, 'error');
    }
}

// Enhanced output display function
function displayOutput(outputElement, content, type = 'normal', message = null) {
    // Clear previous content
    outputElement.innerHTML = '';
    outputElement.className = `output ${type}`;
    
    if (content.trim()) {
        // Show raw output content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'output-content';
        contentDiv.textContent = content;
        outputElement.appendChild(contentDiv);
    }
    
    if (message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `output-message ${type}`;
        messageDiv.textContent = message;
        outputElement.appendChild(messageDiv);
    }
}



// Show hint for a specific problem
function showHint(problemIndex) {
    const problem = currentWorksheet.problems[problemIndex];
    const modal = document.getElementById('hint-modal');
    const hintText = document.getElementById('hint-text');
    
    hintText.textContent = problem.hint;
    modal.style.display = 'flex';
}

// Show completion modal
function showCompletionModal() {
    const modal = document.getElementById('completion-modal');
    const problemsCompleted = document.getElementById('problems-completed');
    
    problemsCompleted.textContent = completedProblems.size;
    
    modal.style.display = 'flex';
}

// Reset Python environment to clear all variables and state
async function resetPythonEnvironment() {
    try {
        // Use a much simpler approach that's more compatible with Pyodide
        await pyodide.runPythonAsync(`
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
        'help', 'dir', 'vars', 'locals', 'globals', 'getattr', 'setattr',
        'hasattr', 'delattr', 'isinstance', 'issubclass', 'super', 'property',
        'staticmethod', 'classmethod', 'object', 'type', 'Exception', 'BaseException',
        'StopIteration', 'GeneratorExit', 'ArithmeticError', 'BufferError',
        'LookupError', 'AssertionError', 'AttributeError', 'EOFError',
        'FloatingPointError', 'OSError', 'ImportError', 'ModuleNotFoundError',
        'IndexError', 'KeyError', 'KeyboardInterrupt', 'MemoryError',
        'NameError', 'OverflowError', 'RecursionError', 'ReferenceError',
        'RuntimeError', 'SyntaxError', 'IndentationError', 'TabError',
        'SystemError', 'TypeError', 'UnboundLocalError', 'UnicodeError',
        'UnicodeEncodeError', 'UnicodeDecodeError', 'UnicodeTranslateError',
        'ValueError', 'ZeroDivisionError', 'BlockingIOError', 'BrokenPipeError',
        'ChildProcessError', 'ConnectionError', 'BrokenPipeError', 'ConnectionAbortedError',
        'ConnectionRefusedError', 'ConnectionResetError', 'FileExistsError',
        'FileNotFoundError', 'InterruptedError', 'IsADirectoryError',
        'NotADirectoryError', 'PermissionError', 'ProcessLookupError',
        'TimeoutError', 'Warning', 'UserWarning', 'DeprecationWarning',
        'PendingDeprecationWarning', 'SyntaxWarning', 'RuntimeWarning',
        'FutureWarning', 'ImportWarning', 'UnicodeWarning', 'BytesWarning',
        'ResourceWarning', 'True', 'False', 'None'
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
}



// Update progress bar
function updateProgress() {
    const progress = (completedProblems.size / currentWorksheet.problems.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${completedProblems.size} of ${currentWorksheet.problems.length} problems completed`;
}

// Setup event listeners
function setupEventListeners() {
    // Back to selection
    document.getElementById('back-to-selection').onclick = showWorksheetSelection;
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.onclick = function() {
            this.closest('.modal').style.display = 'none';
        };
    });
    
    // Completion modal actions
    document.getElementById('restart-worksheet').onclick = () => {
        document.getElementById('completion-modal').style.display = 'none';
        loadWorksheet(currentWorksheet.id);
    };
    
    document.getElementById('next-worksheet').onclick = () => {
        document.getElementById('completion-modal').style.display = 'none';
        const currentIndex = worksheets.findIndex(w => w.id === currentWorksheet.id);
        const nextIndex = (currentIndex + 1) % worksheets.length;
        loadWorksheet(worksheets[nextIndex].id);
    };
    
    document.getElementById('back-to-menu').onclick = () => {
        document.getElementById('completion-modal').style.display = 'none';
        showWorksheetSelection();
    };
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

// Show error message
function showError(message) {
    const output = document.getElementById('output');
    if (output) {
        output.textContent = message;
        output.className = 'output error';
    } else {
        alert(message);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
