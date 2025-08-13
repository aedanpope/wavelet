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
        const response = await fetch('worksheets/index.json');
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
        <div class="worksheet-meta">
            <span class="difficulty-badge ${worksheet.difficulty}">${worksheet.difficulty}</span>
            <span class="time-badge">${worksheet.estimatedTime}</span>
        </div>
        <div class="worksheet-tags">
            ${worksheet.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
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
        const response = await fetch(`worksheets/${worksheet.file}`);
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
    document.getElementById('worksheet-difficulty').textContent = currentWorksheet.difficulty;
    document.getElementById('worksheet-difficulty').className = `difficulty-badge ${currentWorksheet.difficulty}`;
    document.getElementById('worksheet-time').textContent = currentWorksheet.estimatedTime;
    
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
    }, 100);
}

// Create a problem element
function createProblemElement(problem, index) {
    const problemDiv = document.createElement('div');
    problemDiv.className = 'problem-container';
    problemDiv.id = `problem-${index}`;
    
    problemDiv.innerHTML = `
        <div class="problem-header">
            <h2>${problem.title}</h2>
            <div class="problem-meta">
                <span class="type-badge ${problem.type}">${problem.type}</span>
            </div>
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
                <div class="output" id="output-${index}"></div>
            </div>
        </div>
    `;
    
    return problemDiv;
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
        output.textContent = 'Please enter some code to run.';
        return;
    }
    
    try {
        output.textContent = 'Running...';
        
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
        const isValid = validateAnswer(code, printOutput, problem);
        
        if (isValid) {
            // Display output
            output.textContent = printOutput || 'Code executed successfully!';
            output.className = 'output success';
            
            // Mark as completed
            completedProblems.add(problemIndex);
            updateProgress();
            
            // Check if worksheet is complete
            if (completedProblems.size === currentWorksheet.problems.length) {
                setTimeout(showCompletionModal, 1000);
            }
        } else {
            // Show feedback for incorrect answer
            output.textContent = printOutput + '\n\n❌ Not quite right! Check the task requirements and try again.';
            output.className = 'output error';
        }
        
    } catch (error) {
        // Use the shared error handling logic
        const errorInfo = ErrorHandler.extractErrorInfo(error.message);
        output.textContent = errorInfo.fullMessage;
        output.className = 'output error';
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
        // Use a more aggressive approach to clear the environment
        await pyodide.runPythonAsync(`
# Clear all user-defined variables from globals
import sys
import builtins

# Get all current global variables
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

# Add all built-in function names
builtin_names.update(dir(builtins))

# Remove user-defined variables
for var_name in current_globals:
    if var_name not in builtin_names and not var_name.startswith('_'):
        try:
            del globals()[var_name]
        except:
            pass

# Clear imported modules
modules_to_remove = [name for name in sys.modules.keys() 
                    if not name.startswith('_') and name not in ['sys', 'builtins', 'pyodide']]
for module in modules_to_remove:
    if module in sys.modules:
        del sys.modules[module]

# Force garbage collection to clean up any remaining references
import gc
gc.collect()
`);
        
    } catch (error) {
        console.warn('Error resetting Python environment:', error);
        // Continue anyway - the environment will be mostly clean
    }
}

// Validate the student's answer
function validateAnswer(code, output, problem) {
    const codeTrimmed = code.trim();
    const outputTrimmed = output.trim();
    
    // Check if code is too empty (just comments or whitespace)
    const codeWithoutComments = codeTrimmed.replace(/#.*$/gm, '').trim();
    if (codeWithoutComments.length < 5) {
        return false;
    }
    
    // Check for common errors that should fail validation
    if (output.includes('NameError') || output.includes('SyntaxError') || 
        output.includes('TypeError') || output.includes('AttributeError') ||
        output.includes('IndentationError') || output.includes('ZeroDivisionError')) {
        return false;
    }
    
    // Problem-specific validation based on problem type and content
    switch (problem.id) {
        case '1.1':
            // Must have print("Hello, World!")
            return code.includes('print("Hello, World!")') || code.includes("print('Hello, World!')");
            
        case '1.2':
            // Must have print with "My name is" and some name
            return code.includes('print') && code.includes('My name is') && output.includes('My name is');
            
        case '1.3':
            // Must print the number 42
            return code.includes('print(42)') && output.includes('42');
            
        case '1.4':
            // Must have two print statements
            const printCount = (code.match(/print\(/g) || []).length;
            return printCount >= 2 && output.split('\n').filter(line => line.trim()).length >= 2;
            
        case '1.5':
            // Must have three print statements with name, age, and "I love Python!"
            const prints = (code.match(/print\(/g) || []).length;
            return prints >= 3 && output.includes('I love Python!');
            
        case '2.1':
            // Must have variable assignment and print
            return code.includes('=') && code.includes('print') && output.includes('Alice');
            
        case '2.2':
            // Must create 'animal' variable and print it
            return code.includes('animal =') && code.includes('print(animal)') && output.trim().length > 0 && !output.includes('NameError');
            
        case '2.3':
            // Must create 'age' variable with number and print it
            return code.includes('age =') && code.includes('print(age)') && /age\s*=\s*\d+/.test(code);
            
        case '2.4':
            // Must have two variables and add them
            return code.includes('=') && code.includes('+') && code.includes('print') && output.trim().length > 0;
            
        case '2.5':
            // Must have multiple variables and calculations
            const assignments = (code.match(/=/g) || []).length;
            return assignments >= 2 && code.includes('print') && output.split('\n').filter(line => line.trim()).length >= 3;
            
        case '3.1':
            // Must use input() and print
            return code.includes('input(') && code.includes('print(') && output.includes('Hello,');
            
        case '3.2':
            // Must use input() for color and print message
            return code.includes('input(') && code.includes('I like') && output.includes('I like');
            
        case '3.3':
            // Must use input() for age and print age message
            return code.includes('input(') && code.includes('years old') && output.includes('years old');
            
        case '3.4':
            // Must use input() twice and int() conversion
            return code.includes('input(') && code.includes('int(') && code.includes('+') && output.includes('sum');
            
        case '3.5':
            // Must use input() three times and create summary
            const inputCount = (code.match(/input\(/g) || []).length;
            return inputCount >= 3 && output.includes('Hello') && output.includes('years old') && output.includes('love');
            
        default:
            // For unknown problems, require at least some meaningful code and output
            return codeWithoutComments.length > 10 && outputTrimmed.length > 0;
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
