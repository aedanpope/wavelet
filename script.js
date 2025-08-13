// Global variables
let pyodide = null;
let editors = {};
let lessonStatus = {};

// Lesson configurations with initial code and answer checking
const lessons = {
    1: {
        title: "Your First Python Program",
        initialCode: "# Type your code here\n# Try: print(\"Hello, World!\")",
        task: "Write a program that prints \"Hello, World!\" to the screen.",
        checkAnswer: (output) => {
            return output.includes("Hello, World!");
        },
        successMessage: "🎉 Perfect! You've written your first Python program!",
        hint: "Use print() with quotes around your text."
    },
    2: {
        title: "Print with Variables",
        initialCode: "# Create a variable and print it\n# Example: name = \"Alice\"\n# Then: print(name)",
        task: "Create a variable called message with the value \"Python is fun!\" and then print it.",
        checkAnswer: (output) => {
            return output.includes("Python is fun!");
        },
        successMessage: "🎉 Great! You've learned how to use variables with print!",
        hint: "First create the variable, then print it."
    },
    3: {
        title: "Understanding String Quotes",
        initialCode: "# Fix the syntax error below\nprint(Hello World)",
        task: "Fix the syntax error in the code. The string is missing quotes around it!",
        checkAnswer: (output) => {
            return output.includes("Hello World") && !output.includes("SyntaxError");
        },
        successMessage: "🎉 Excellent! You've fixed the syntax error!",
        hint: "Strings need quotes around them."
    },
    4: {
        title: "Multiple Print Statements",
        initialCode: "# Write two print statements\n# One for your name\n# One for your favorite color",
        task: "Write two print statements: one that prints your name, and another that prints your favorite color.",
        checkAnswer: (output) => {
            const lines = output.trim().split('\n').filter(line => line.trim());
            return lines.length >= 2;
        },
        successMessage: "🎉 Perfect! You can now use multiple print statements!",
        hint: "Each print() creates a new line."
    },
    5: {
        title: "Print with Numbers",
        initialCode: "# Print a number and some text\n# Example: print(100)\n# Then: print(\"is a big number\")",
        task: "Print the number 100 (without quotes) and then print the text \"is a big number\" (with quotes).",
        checkAnswer: (output) => {
            return output.includes("100") && output.includes("is a big number");
        },
        successMessage: "🎉 Amazing! You understand the difference between numbers and strings!",
        hint: "Numbers don't need quotes, but text does."
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEditors();
    initializePyodide();
    updateProgress();
});

// Initialize all code editors
function initializeEditors() {
    for (let i = 1; i <= 5; i++) {
        const editorElement = document.getElementById(`editor-${i}`);
        if (editorElement) {
            editors[i] = CodeMirror(editorElement, {
                mode: 'python',
                theme: 'monokai',
                lineNumbers: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                indentUnit: 4,
                tabSize: 4,
                indentWithTabs: false,
                lineWrapping: true,
                value: lessons[i].initialCode
            });
        }
    }
}

// Initialize Pyodide
async function initializePyodide() {
    try {
        // Check if Pyodide is available
        if (typeof window.loadPyodide === 'undefined') {
            throw new Error('Pyodide script not loaded. Please check your internet connection and refresh the page.');
        }
        
        // Use the global loadPyodide function from the CDN
        pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
        });
        
        // Wait a moment for Pyodide to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test that Pyodide is working
        try {
            const testResult = pyodide.runPython('2 + 2');
            console.log('Pyodide test result:', testResult);
        } catch (testError) {
            console.warn('Pyodide test failed:', testError);
        }
        
        console.log('✅ Pyodide loaded successfully!');
        
    } catch (error) {
        console.error('Pyodide loading error:', error);
        showGlobalMessage('❌ Error loading Pyodide. Please refresh the page.', 'error');
    }
}

// Run code for a specific section
async function runSection(sectionNumber) {
    if (!pyodide) {
        showSectionMessage(sectionNumber, '❌ Pyodide is not loaded yet. Please wait...', 'error');
        return;
    }

    const editor = editors[sectionNumber];
    const outputElement = document.getElementById(`output-${sectionNumber}`);
    const runBtn = document.querySelector(`#editor-${sectionNumber}`).parentElement.querySelector('.run-btn');
    
    if (!editor || !outputElement) return;

    const code = editor.getValue();
    if (!code.trim()) {
        showSectionMessage(sectionNumber, '❌ No code to run. Please enter some Python code.', 'error');
        return;
    }

    // Disable run button and show loading
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running...';
    
    try {
        // Clear previous output
        outputElement.innerHTML = '';
        outputElement.className = 'output';
        
        // Capture stdout
        let stdout = '';
        pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
`);
        
        // Run the user's code
        const result = await pyodide.runPythonAsync(code);
        
        // Get captured output
        stdout = pyodide.runPython("sys.stdout.getvalue()");
        pyodide.runPython("sys.stdout = sys.__stdout__");
        
        // Display output
        if (stdout.trim()) {
            outputElement.textContent = stdout;
            outputElement.className = 'output success';
        } else {
            outputElement.textContent = 'Code ran successfully but produced no output.';
            outputElement.className = 'output info';
        }
        
        // Check if answer is correct
        const lesson = lessons[sectionNumber];
        if (lesson && lesson.checkAnswer) {
            const isCorrect = lesson.checkAnswer(stdout);
            
            if (isCorrect) {
                // Mark lesson as completed
                lessonStatus[sectionNumber] = 'completed';
                updateLessonStatus(sectionNumber, 'completed');
                updateProgress();
                
                // Show success message
                setTimeout(() => {
                    showSectionMessage(sectionNumber, lesson.successMessage, 'success');
                }, 500);
            } else {
                // Mark lesson as in progress
                lessonStatus[sectionNumber] = 'in-progress';
                updateLessonStatus(sectionNumber, 'in-progress');
                updateProgress();
                
                // Show hint
                setTimeout(() => {
                    showSectionMessage(sectionNumber, `💡 Hint: ${lesson.hint}`, 'info');
                }, 500);
            }
        }
        
    } catch (error) {
        outputElement.textContent = `❌ Error: ${error.message}`;
        outputElement.className = 'output error';
        
        // Mark lesson as in progress if there's an error
        lessonStatus[sectionNumber] = 'in-progress';
        updateLessonStatus(sectionNumber, 'in-progress');
        updateProgress();
    } finally {
        // Re-enable run button
        runBtn.disabled = false;
        runBtn.textContent = '▶ Run Code';
    }
}

// Show message for a specific section
function showSectionMessage(sectionNumber, message, type) {
    const outputElement = document.getElementById(`output-${sectionNumber}`);
    if (outputElement) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        outputElement.appendChild(messageDiv);
    }
}

// Show global message
function showGlobalMessage(message, type) {
    // Create a temporary message at the top of the page
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translateX(-50%)';
    messageDiv.style.zIndex = '1000';
    messageDiv.style.padding = '15px 30px';
    messageDiv.style.borderRadius = '8px';
    messageDiv.style.fontWeight = 'bold';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 5000);
}

// Update lesson status display
function updateLessonStatus(sectionNumber, status) {
    const statusElement = document.getElementById(`status-${sectionNumber}`);
    if (statusElement) {
        statusElement.textContent = status === 'completed' ? '✅ Completed' : 
                                   status === 'in-progress' ? '🔄 In Progress' : '⏳ Not Started';
        statusElement.className = `lesson-status ${status}`;
    }
}

// Update progress bar
function updateProgress() {
    const completedLessons = Object.values(lessonStatus).filter(status => status === 'completed').length;
    const totalLessons = 5;
    const percentage = (completedLessons / totalLessons) * 100;
    
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${completedLessons} out of ${totalLessons} lessons completed`;
    }
}

// Initialize lesson statuses
for (let i = 1; i <= 5; i++) {
    lessonStatus[i] = 'not-started';
    updateLessonStatus(i, 'not-started');
}
