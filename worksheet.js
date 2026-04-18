// Global variables
let currentWorksheet = null;
let codeEditors = []; // Array to hold multiple code editors
let completedProblems = new Set();
let codeExecutor = null;

// Returns only actual coding problems (excludes concept/trace cards etc.)
function getProblems() {
    return currentWorksheet.problems.filter(b => b.type !== 'concept' && b.type !== 'trace');
}

// Serialise current worksheet state and persist via ProgressStore.
function saveProgress(worksheetId) {
    const worksheetProgress = {
        completedProblems: Array.from(completedProblems),
        problems: []
    };

    getProblems().forEach((problem, index) => {
        const codeEditor = codeEditors[index];
        const outputElement = document.getElementById(`output-${index}`);

        const problemState = {
            code: codeEditor ? codeEditor.getValue() : '',
            completed: completedProblems.has(index)
        };

        if (outputElement && outputElement.innerHTML !== '') {
            const outputContent = outputElement.querySelector('.output-content');
            const outputMessage = outputElement.querySelector('.output-message');
            if (outputContent) problemState.output = outputContent.textContent;
            if (outputMessage) {
                problemState.message = outputMessage.textContent;
                problemState.status = outputElement.className.includes('success') ? 'success'
                                    : outputElement.className.includes('error')   ? 'error'
                                    : 'normal';
            }
        }

        worksheetProgress.problems.push(problemState);
    });

    ProgressStore.saveWorksheet(worksheetId, worksheetProgress);
}

function clearWorksheetProgress(worksheetId) {
    ProgressStore.clearWorksheet(worksheetId);
    location.reload();
}

// Initialize the application
async function init() {
    try {
        // Check version and clear storage if needed
        ProgressStore.checkVersion();

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

// Initialize Pyodide and CodeExecutor
async function initPyodide() {
    try {
        // Initialize the CodeExecutor
        codeExecutor = new CodeExecutor();
        await codeExecutor.initialize();
        
        console.log('Pyodide and CodeExecutor initialized successfully');
    } catch (error) {
        console.error('Error loading Pyodide:', error);
        throw new Error('Failed to load Python runtime');
    }
}

// Load a specific worksheet
async function loadWorksheet(worksheetId) {
    try {
        // Construct the worksheet filename directly from the ID
        const worksheetFile = `${worksheetId}.json`;
        
        // Load worksheet data directly
        const response = await fetch(`worksheets/${worksheetFile}?t=${Date.now()}`);
        if (!response.ok) {
            throw new Error('Worksheet not found');
        }
        currentWorksheet = await response.json();
        
        // Load saved progress
        const savedProgress = ProgressStore.loadWorksheet(worksheetId);
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
    
    let problemIndex = 0;
    let traceIndex = 0;
    currentWorksheet.problems.forEach((block) => {
        if (block.type === 'concept') {
            container.appendChild(ProblemRenderer.createConceptElement(block));
        } else if (block.type === 'trace') {
            container.appendChild(ProblemRenderer.createTraceElement(block, traceIndex));
            traceIndex++;
        } else {
            container.appendChild(ProblemRenderer.createProblemElement(block, problemIndex));
            problemIndex++;
        }
    });
    
    // Initialize all code editors after DOM is ready.
    // CodeMirror calls scrollIntoView on its cursor during construction and
    // during setValue, which would yank the page viewport down to the first
    // editor on load. Snapshot/restore window.scrollY around the whole
    // bootstrap block so the viewport stays at the top of the page.
    setTimeout(() => {
        const savedScrollY = window.scrollY;

        initAllCodeEditors();
        initAllTraceEditors();

        // Restore saved state if available
        const savedProgress = ProgressStore.loadWorksheet(currentWorksheet.id);
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
        getProblems().forEach((problem, index) => {
            const problemElement = document.getElementById(`problem-${index}`);
            if (problemElement) {
                renderLatexInElement(problemElement);
            }
        });

        window.scrollTo(window.scrollX, savedScrollY);

        // Don't show scroll hint initially - only show after completing problem 1
    }, 100);
}

// Initialize all CodeMirror editors
function initAllCodeEditors() {
    getProblems().forEach((problem, index) => {
        const containerEl = document.getElementById(`code-editor-${index}`);
        codeEditors[index] = ProblemRenderer.createEditor(containerEl, problem);
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
    let code = codeEditors[problemIndex].getValue();
    const output = document.getElementById(`output-${problemIndex}`);
    const problem = getProblems()[problemIndex];

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
        await codeExecutor.resetPythonEnvironment(problemIndex);

        // Set up the get_input() function if the problem has inputs
        InputSystem.setupGetInputFunction(codeExecutor.getPyodide(), problem, problemIndex);
        // Set up the get_choice() function for all problems
        InputSystem.setupGetChoiceFunction(codeExecutor.getPyodide(), problemIndex);

        // Set up canvas functions if the problem has canvas enabled
        if (problem.canvas && typeof setupCanvasFunctions !== 'undefined') {
            setupCanvasFunctions(codeExecutor.getPyodide(), problemIndex);
        }

        // Process code for async handling
        code = codeExecutor.processCodeForAsync(code);

        // Execute code with output capture
        const executionResult = await codeExecutor.executeCode(code, output, problemIndex);
        
        // Collect user's actual input values for better first-failure error messages
        const userInputValues = {};
        if (problem.inputs && problem.inputs.length > 0) {
            problem.inputs.forEach(input => {
                const el = document.getElementById(`input-${problemIndex}-${input.name}`);
                if (el) {
                    let value = el.value;
                    if (input.type === 'number') value = parseFloat(value) || 0;
                    else if (input.type === 'boolean') value = value === 'true';
                    userInputValues[input.name] = value;
                }
            });
        }
        const validationResult = await Validation.validateAnswer(code, executionResult.printOutput, problem, problemIndex, codeExecutor, userInputValues);
        
        displayOutput(output, executionResult.printOutput, validationResult.isValid ? 'success' : 'error', validationResult.message);
        
        // Update progress if problem is completed
        if (validationResult.isValid && !completedProblems.has(problemIndex)) {
            completedProblems.add(problemIndex);
            updateProgress();
            
            // Show and animate scroll hint if problem 1 is completed
            if (problemIndex === 0 && getProblems().length > 1) {
                showScrollHint();
                animateScrollHint();
            }
            
            // Check if all problems are completed
            if (completedProblems.size === getProblems().length) {
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

function displayOutput(outputElement, content, type = 'normal', message = null) {
    ProblemRenderer.displayOutput(outputElement, content, type, message);
}

// Reset a specific problem to its default state
function resetProblem(problemIndex) {
    if (confirm('Are you sure you want to reset this problem? This will clear your code and output.')) {
        const problem = getProblems()[problemIndex];
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
    const problem = getProblems()[problemIndex];
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
    const progress = (completedProblems.size / getProblems().length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${completedProblems.size} of ${getProblems().length} problems completed`;
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
        hideScrollHint();
    });
}

// Show scroll hint
function showScrollHint() {
    const scrollHint = document.getElementById('scroll-hint');
    if (scrollHint) {
        scrollHint.style.display = 'flex';
    }
}

// Animate scroll hint
function animateScrollHint() {
    const scrollHint = document.getElementById('scroll-hint');
    if (scrollHint) {
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

const tracePlayerInstances = [];

function createTraceElement(block, traceIndex) {
    const id = traceIndex;
    const div = document.createElement('div');
    div.className = 'trace-card';
    div.innerHTML = `
        <div class="trace-card-header">
            <span class="trace-card-icon">▶</span>
            <h3>${block.title || 'Watch it run'}</h3>
        </div>
        <div class="trace-card-footer">
            <div class="trace-step-count" id="trace-card-count-${id}">Step 1 / ${block.steps.length}</div>
            <div class="trace-card-controls">
                <button class="trace-btn" id="trace-card-first-${id}" title="First step">⏮</button>
                <button class="trace-btn" id="trace-card-prev-${id}" title="Previous step">◀</button>
                <button class="trace-btn" id="trace-card-next-${id}" title="Next step">▶</button>
                <button class="trace-btn" id="trace-card-last-${id}" title="Last step">⏭</button>
                <button class="trace-btn trace-btn-play" id="trace-card-play-${id}">▶ Play</button>
                <input class="trace-slider" type="range" id="trace-card-slider-${id}" min="0" max="${block.steps.length - 1}" value="0">
            </div>
        </div>
        <div class="trace-card-layout">
            <div class="trace-card-editor-wrap">
                <div id="trace-card-editor-${id}"></div>
            </div>
            <div class="trace-card-vars-col" id="trace-card-vars-col-${id}">
                <div class="trace-panel-title">Variables</div>
                <div class="trace-vars" id="trace-card-vars-${id}"><span class="trace-empty">No variables yet</span></div>
            </div>
            <div class="trace-card-output-col" id="trace-card-output-col-${id}">
                <div class="trace-panel-title">Output</div>
                <div class="trace-output-content" id="trace-card-output-${id}"></div>
            </div>
        </div>
    `;
    return div;
}

function initAllTraceEditors() {
    tracePlayerInstances.length = 0;
    let traceIndex = 0;
    currentWorksheet.problems.forEach(block => {
        if (block.type !== 'trace') return;
        const id = traceIndex++;
        const editorEl = document.getElementById(`trace-card-editor-${id}`);
        if (!editorEl) return;

        const editor = ProblemRenderer.createTraceEditor(editorEl, block);

        const elFn = name => document.getElementById(`trace-card-${name}-${id}`);
        const player = new TracePlayer(block.steps, editor, elFn);
        tracePlayerInstances.push(player);

        elFn('first').addEventListener('click', () => player.goToStep(0));
        elFn('prev').addEventListener('click',  () => player.goToStep(player.currentStep - 1));
        elFn('next').addEventListener('click',  () => player.goToStep(player.currentStep + 1));
        elFn('last').addEventListener('click',  () => player.goToStep(player.steps.length - 1));
        elFn('play').addEventListener('click',  () => player.playTimer ? player.pause() : player.play());
        elFn('slider').addEventListener('input', e => player.goToStep(parseInt(e.target.value)));

        player.goToStep(0);

        // Ratchet panel heights so they don't shrink as steps change
        const ratchet = colId => {
            const el = elFn(colId);
            if (!el) return;
            const h = Math.ceil(el.getBoundingClientRect().height);
            if (h > (parseInt(el.style.minHeight) || 0)) el.style.minHeight = h + 'px';
        };
        const origGoToStep = player.goToStep.bind(player);
        player.goToStep = n => { origGoToStep(n); ratchet('vars-col'); ratchet('output-col'); };
        player.goToStep(0);
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
