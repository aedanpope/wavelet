// Global variables
let pyodide = null;
let currentWorksheet = null;
let codeEditors = []; // Array to hold multiple code editors
let completedProblems = new Set();
let hasScrolled = false; // Track if user has scrolled

// Progress persistence functions
function saveProgress(worksheetId) {
    try {
        const allProgress = JSON.parse(localStorage.getItem('pythonProgress') || '{}');
        const worksheetProgress = {
            completedProblems: Array.from(completedProblems),
            problems: []
        };
        
        // Save state for each problem
        currentWorksheet.problems.forEach((problem, index) => {
            const codeEditor = codeEditors[index];
            const outputElement = document.getElementById(`output-${index}`);
            
            let problemState = {
                code: codeEditor ? codeEditor.getValue() : '',
                completed: completedProblems.has(index)
            };
            
            // Save output and status if available
            if (outputElement && outputElement.innerHTML !== '') {
                const outputContent = outputElement.querySelector('.output-content');
                const outputMessage = outputElement.querySelector('.output-message');
                
                if (outputContent) {
                    problemState.output = outputContent.textContent;
                }
                if (outputMessage) {
                    problemState.message = outputMessage.textContent;
                    problemState.status = outputElement.className.includes('success') ? 'success' : 
                                        outputElement.className.includes('error') ? 'error' : 'normal';
                }
            }
            
            worksheetProgress.problems.push(problemState);
        });
        
        allProgress[worksheetId] = worksheetProgress;
        localStorage.setItem('pythonProgress', JSON.stringify(allProgress));
    } catch (error) {
        console.warn('Failed to save progress:', error);
    }
}

function loadProgress(worksheetId) {
    try {
        const allProgress = JSON.parse(localStorage.getItem('pythonProgress') || '{}');
        return allProgress[worksheetId] || null;
    } catch (error) {
        console.warn('Failed to load progress:', error);
        return null;
    }
}

function clearWorksheetProgress(worksheetId) {
    try {
        const allProgress = JSON.parse(localStorage.getItem('pythonProgress') || '{}');
        delete allProgress[worksheetId];
        localStorage.setItem('pythonProgress', JSON.stringify(allProgress));
        location.reload();
    } catch (error) {
        console.warn('Failed to clear progress:', error);
        location.reload();
    }
}

// Initialize the application
async function init() {
    try {
        // Get worksheet ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const worksheetId = urlParams.get('id');
        
        if (!worksheetId) {
            // Redirect to home page if no worksheet ID
            window.location.href = 'index.html';
            return;
        }
        
        // Initialize Pyodide
        await initPyodide();
        
        // Load the specific worksheet
        await loadWorksheet(worksheetId);
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please refresh the page.');
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

// Load a specific worksheet
async function loadWorksheet(worksheetId) {
    try {
        // First, load the worksheets index to find the worksheet file
        const indexResponse = await fetch('worksheets/index.json?t=' + Date.now());
        const indexData = await indexResponse.json();
        
        const worksheet = indexData.worksheets.find(w => w.id === worksheetId);
        if (!worksheet) {
            throw new Error('Worksheet not found');
        }
        
        // Load worksheet data
        const response = await fetch(`worksheets/${worksheet.file}?t=${Date.now()}`);
        currentWorksheet = await response.json();
        
        // Load saved progress
        const savedProgress = loadProgress(worksheetId);
        if (savedProgress) {
            completedProblems = new Set(savedProgress.completedProblems || []);
        } else {
            completedProblems.clear();
        }
        
        // Update page title
        document.title = `Python Learning Platform - ${currentWorksheet.title}`;
        
        // Show worksheet interface
        showWorksheetInterface();
        

        
    } catch (error) {
        console.error('Error loading worksheet:', error);
        // Hide loading overlay and show error
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('worksheet-interface').style.display = 'block';
        showError('Failed to load worksheet. Please try again.');
    }
}

// Show worksheet interface
function showWorksheetInterface() {
    // Hide loading overlay
    document.getElementById('loading-overlay').style.display = 'none';
    
    // Show worksheet interface
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
        
        // Restore saved state if available
        const savedProgress = loadProgress(currentWorksheet.id);
        if (savedProgress && savedProgress.problems) {
            savedProgress.problems.forEach((problemState, index) => {
                // Restore code
                if (codeEditors[index] && problemState.code) {
                    codeEditors[index].setValue(problemState.code);
                }
                
                // Restore output and status
                if (problemState.output || problemState.message) {
                    const outputElement = document.getElementById(`output-${index}`);
                    if (outputElement) {
                        displayOutput(outputElement, problemState.output || '', 
                                   problemState.status || 'normal', problemState.message || null);
                    }
                }
            });
        }
        
        // Update progress bar after restoring saved state
        updateProgress();
        
        // Render LaTeX content in all problem elements
        currentWorksheet.problems.forEach((problem, index) => {
            const problemElement = document.getElementById(`problem-${index}`);
            if (problemElement) {
                renderLatexInElement(problemElement);
            }
        });
        
        // Don't show scroll hint initially - only show after completing problem 1
    }, 100);
}

// Create a problem element
function createProblemElement(problem, index) {
    const problemDiv = document.createElement('div');
    problemDiv.className = 'problem-container';
    problemDiv.id = `problem-${index}`;
    
    // Generate input fields HTML if the problem has inputs
    let inputsHTML = '';
    if (problem.inputs && problem.inputs.length > 0) {
        inputsHTML = `
            <div class="input-section">
                <div class="input-fields" id="input-fields-${index}">
                    ${problem.inputs.map(input => `
                        <div class="input-field">
                            <label for="input-${index}-${input.name}">${input.name} =</label>
                            <input 
                                type="${input.type}" 
                                id="input-${index}-${input.name}" 
                                name="${input.name}"
                                placeholder="${input.placeholder || ''}"
                                class="problem-input"
                            >
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
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
                        <button class="reset-btn" onclick="resetProblem(${index})">🔄 Reset</button>
                    </div>
                </div>
                <div class="code-editor" id="code-editor-${index}"></div>
                
                ${inputsHTML}
                
                <div class="output-section">
                    <div class="output-header">
                        <span>Output</span>
                        <button class="run-btn" onclick="runCode(${index})">▶ Run Code</button>
                    </div>
                    <div class="output" id="output-${index}">
                        <div class="output-placeholder">Click "Run Code" to see your output here</div>
                    </div>
                </div>
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
        
        // Set editor height based on problem configuration (default: 3 lines)
        const height = problem.codeHeight || 3;
        editor.setSize(null, height * 23 + 10);
        
        codeEditors[index] = editor;
    });
}

// Validate that all required input fields are filled
function validateInputs(problem, problemIndex) {
    if (!problem.inputs || problem.inputs.length === 0) {
        return { isValid: true, missingInputs: [] };
    }
    
    const missingInputs = [];
    
    for (const input of problem.inputs) {
        const inputElement = document.getElementById(`input-${problemIndex}-${input.name}`);
        if (inputElement && !inputElement.value.trim()) {
            missingInputs.push(input.name);
        }
    }
    
    return {
        isValid: missingInputs.length === 0,
        missingInputs: missingInputs
    };
}

// Run Python code for a specific problem
async function runCode(problemIndex) {
    const code = codeEditors[problemIndex].getValue();
    const output = document.getElementById(`output-${problemIndex}`);
    const problem = currentWorksheet.problems[problemIndex];
    
    if (!code.trim()) {
        displayOutput(output, 'Please enter some code to run.', 'error', '❌ Please enter some code to run.');
        return;
    }
    
    // Validate that all required input fields are filled
    const inputValidation = validateInputs(problem, problemIndex);
    if (!inputValidation.isValid) {
        const missingList = inputValidation.missingInputs.join(', ');
        displayOutput(output, '', 'error', `❌ Please fill in all input fields: ${missingList}`);
        return;
    }
    
    try {
        // Show running state
        displayOutput(output, '', 'running');
        
        // Reset Python environment to clear previous state
        await resetPythonEnvironment();
        
        // Set up the get_input() function if the problem has inputs
        InputSystem.setupGetInputFunction(pyodide, problem, problemIndex);
        
        // Capture print output
        let printOutput = '';
        const originalPrint = pyodide.globals.get('print');
        pyodide.globals.set('print', function(...args) {
            printOutput += args.join(' ') + '\n';
        });
        
        await pyodide.runPythonAsync(code);
        pyodide.globals.set('print', originalPrint);
        
        const isValid = await Validation.validateAnswer(code, printOutput, problem, problemIndex);
        const message = isValid ? '✅ Correct! Well done!' : '❌ Not quite right! Check the task requirements and try again.';
        displayOutput(output, printOutput, isValid ? 'success' : 'error', message);
        
        // Update progress if problem is completed
        if (isValid && !completedProblems.has(problemIndex)) {
            completedProblems.add(problemIndex);
            updateProgress();
            
            // Show and animate scroll hint if problem 1 is completed
            if (problemIndex === 0 && !hasScrolled && currentWorksheet.problems.length > 1) {
                showScrollHint();
                animateScrollHint();
            }
            
            // Check if all problems are completed
            if (completedProblems.size === currentWorksheet.problems.length) {
                showCompletionModal();
            }
        }
        
        // Save progress after every run (success or failure)
        saveProgress(currentWorksheet.id);
        
    } catch (error) {
        const errorInfo = ErrorHandler.extractErrorInfo(error.message);
        displayOutput(output, errorInfo.fullMessage, 'error', '❌ There was an error running your code.');
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

// Reset a specific problem to its default state
function resetProblem(problemIndex) {
    if (confirm('Are you sure you want to reset this problem? This will clear your code and output.')) {
        const problem = currentWorksheet.problems[problemIndex];
        const codeEditor = codeEditors[problemIndex];
        const outputElement = document.getElementById(`output-${problemIndex}`);
        
        // Reset code to starter code
        if (codeEditor) {
            codeEditor.setValue(problem.starterCode || '');
        }
        
        // Clear output
        if (outputElement) {
            outputElement.innerHTML = '<div class="output-placeholder">Click "Run Code" to see your output here</div>';
            outputElement.className = 'output';
        }
        
        // Remove from completed problems if it was completed
        if (completedProblems.has(problemIndex)) {
            completedProblems.delete(problemIndex);
            updateProgress();
        }
        
        // Save progress after reset
        saveProgress(currentWorksheet.id);
    }
}

// Show hint for a specific problem
function showHint(problemIndex) {
    const problem = currentWorksheet.problems[problemIndex];
    const modal = document.getElementById('hint-modal');
    const hintText = document.getElementById('hint-text');
    
    hintText.innerHTML = problem.hint;
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
}

// Render LaTeX content in a problem element
function renderLatexInElement(element) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([element]).catch((err) => {
            console.warn('MathJax rendering error:', err);
        });
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
    document.getElementById('back-to-selection').onclick = () => {
        window.location.href = 'index.html';
    };
    
    // Start over button
    document.getElementById('start-over').onclick = () => {
        if (confirm('Are you sure you want to start over? This will clear your progress for this worksheet.')) {
            clearWorksheetProgress(currentWorksheet.id);
        }
    };
    
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
        // Get next worksheet from index
        fetch('worksheets/index.json?t=' + Date.now())
            .then(response => response.json())
            .then(data => {
                const currentIndex = data.worksheets.findIndex(w => w.id === currentWorksheet.id);
                const nextIndex = (currentIndex + 1) % data.worksheets.length;
                const nextWorksheet = data.worksheets[nextIndex];
                window.location.href = `worksheet.html?id=${nextWorksheet.id}`;
            });
    };
    
    document.getElementById('back-to-menu').onclick = () => {
        document.getElementById('completion-modal').style.display = 'none';
        window.location.href = 'index.html';
    };
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
    
    // Track scroll to hide scroll hint
    window.addEventListener('scroll', function() {
        if (!hasScrolled) {
            hasScrolled = true;
            hideScrollHint();
        }
    });
}

// Show scroll hint
function showScrollHint() {
    const scrollHint = document.getElementById('scroll-hint');
    if (scrollHint && !hasScrolled) {
        scrollHint.style.display = 'flex';
    }
}

// Animate scroll hint
function animateScrollHint() {
    const scrollHint = document.getElementById('scroll-hint');
    if (scrollHint && !hasScrolled) {
        scrollHint.classList.add('animate');
    }
}

// Hide scroll hint
function hideScrollHint() {
    const scrollHint = document.getElementById('scroll-hint');
    if (scrollHint) {
        scrollHint.style.display = 'none';
        scrollHint.classList.remove('animate');
    }
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
