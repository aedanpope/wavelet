// Global variables
let pyodide = null;
let currentWorksheet = null;
let currentProblemIndex = 0;
let codeEditor = null;
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
        currentProblemIndex = 0;
        completedProblems.clear();
        
        // Show worksheet interface
        showWorksheetInterface();
        
        // Load first problem
        loadProblem(0);
        
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
    
    // Initialize code editor if not already done
    if (!codeEditor) {
        initCodeEditor();
    }
}

// Initialize CodeMirror editor
function initCodeEditor() {
    const editorElement = document.getElementById('code-editor');
    codeEditor = CodeMirror(editorElement, {
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
}

// Load a specific problem
function loadProblem(index) {
    if (index < 0 || index >= currentWorksheet.problems.length) {
        return;
    }
    
    currentProblemIndex = index;
    const problem = currentWorksheet.problems[index];
    
    // Update problem info
    document.getElementById('problem-title').textContent = problem.title;
    document.getElementById('problem-type').textContent = problem.type;
    document.getElementById('problem-type').className = `type-badge ${problem.type}`;
    document.getElementById('problem-points').textContent = `${problem.points} points`;
    document.getElementById('problem-content').innerHTML = problem.content;
    document.getElementById('task-text').textContent = problem.task;
    
    // Set starter code
    codeEditor.setValue(problem.starterCode || '');
    
    // Clear output
    document.getElementById('output').textContent = '';
    
    // Update navigation
    updateNavigation();
    updateProgress();
}

// Update navigation buttons
function updateNavigation() {
    const prevBtn = document.getElementById('prev-problem');
    const nextBtn = document.getElementById('next-problem');
    const counter = document.getElementById('problem-counter');
    
    prevBtn.disabled = currentProblemIndex === 0;
    nextBtn.disabled = currentProblemIndex === currentWorksheet.problems.length - 1;
    
    counter.textContent = `Problem ${currentProblemIndex + 1} of ${currentWorksheet.problems.length}`;
}

// Update progress bar
function updateProgress() {
    const progress = (completedProblems.size / currentWorksheet.problems.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${completedProblems.size} of ${currentWorksheet.problems.length} problems completed`;
}

// Run Python code
async function runCode() {
    const code = codeEditor.getValue();
    const output = document.getElementById('output');
    
    if (!code.trim()) {
        output.textContent = 'Please enter some code to run.';
        return;
    }
    
    try {
        output.textContent = 'Running...';
        
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
        
        // Display output
        output.textContent = printOutput || 'Code executed successfully!';
        output.className = 'output success';
        
        // Mark as completed
        completedProblems.add(currentProblemIndex);
        updateProgress();
        
        // Check if worksheet is complete
        if (completedProblems.size === currentWorksheet.problems.length) {
            setTimeout(showCompletionModal, 1000);
        }
        
    } catch (error) {
        output.textContent = `Error: ${error.message}`;
        output.className = 'output error';
    }
}

// Show hint modal
function showHint() {
    const problem = currentWorksheet.problems[currentProblemIndex];
    const modal = document.getElementById('hint-modal');
    const hintText = document.getElementById('hint-text');
    
    hintText.textContent = problem.hint;
    modal.style.display = 'flex';
}

// Show completion modal
function showCompletionModal() {
    const modal = document.getElementById('completion-modal');
    const totalPoints = document.getElementById('total-points');
    const problemsCompleted = document.getElementById('problems-completed');
    
    // Calculate total points
    const points = currentWorksheet.problems
        .filter((_, index) => completedProblems.has(index))
        .reduce((sum, problem) => sum + problem.points, 0);
    
    totalPoints.textContent = points;
    problemsCompleted.textContent = completedProblems.size;
    
    modal.style.display = 'flex';
}

// Setup event listeners
function setupEventListeners() {
    // Navigation buttons
    document.getElementById('prev-problem').onclick = () => {
        if (currentProblemIndex > 0) {
            loadProblem(currentProblemIndex - 1);
        }
    };
    
    document.getElementById('next-problem').onclick = () => {
        if (currentProblemIndex < currentWorksheet.problems.length - 1) {
            loadProblem(currentProblemIndex + 1);
        }
    };
    
    // Back to selection
    document.getElementById('back-to-selection').onclick = showWorksheetSelection;
    
    // Run code
    document.getElementById('run-code').onclick = runCode;
    
    // Show hint
    document.getElementById('show-hint').onclick = showHint;
    
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
