// Shared input system logic for the Python learning platform
// This module contains the input handling functions used by both worksheet.js and test files

/**
 * Creates a get_input function for a specific problem
 * @param {Object} problem - The problem configuration object
 * @param {number} problemIndex - The index of the problem
 * @returns {Function} The get_input function to be used in Python
 */
function createGetInputFunction(problem, problemIndex) {
    return function(inputName) {
        let targetInputName = inputName;
        let inputElement;
        
        // If no argument provided, use the first input field
        if (inputName === undefined || inputName === null) {
            if (problem.inputs && problem.inputs.length > 0) {
                targetInputName = problem.inputs[0].name;
            } else {
                throw new Error("No input fields are available for this problem. Use get_input() only when the problem has input boxes.");
            }
        }
        
        inputElement = document.getElementById(`input-${problemIndex}-${targetInputName}`);
        if (inputElement) {
            let value = inputElement.value;
            
            // Find the input configuration to determine type
            const inputConfig = problem.inputs.find(input => input.name === targetInputName);
            if (inputConfig) {
                // Convert value based on input type
                if (inputConfig.type === 'number') {
                    value = parseFloat(value) || 0;
                } else if (inputConfig.type === 'boolean') {
                    value = value === 'true';
                }
            }
            
            return value;
        }
        
        // Provide a helpful error message when input field is not found
        const availableInputs = problem.inputs ? problem.inputs.map(input => `'${input.name}'`).join(', ') : 'none';
        throw new Error(`Input field '${targetInputName}' not found. Available input fields: ${availableInputs}. Make sure you're using the correct input name that matches the label on the input box.`);
    };
}





/**
 * Creates the choice UI with numbered buttons
 * @param {number} problemIndex - The index of the problem
 * @param {number} n - Number of choices
 * @returns {HTMLElement} The choice container element
 */
function createChoiceUI(problemIndex, n) {
    // Remove any existing choice UI for this problem
    const existingChoice = document.getElementById(`choice-container-${problemIndex}`);
    if (existingChoice) {
        existingChoice.remove();
    }
    
    // Create choice container - simplified structure
    const choiceContainer = document.createElement('div');
    choiceContainer.id = `choice-container-${problemIndex}`;
    choiceContainer.className = 'choice-buttons';
    
    // Create buttons directly
    for (let i = 1; i <= n; i++) {
        const button = document.createElement('button');
        button.className = 'choice-btn';
        button.id = `choice-${problemIndex}-${i}`;
        button.textContent = i;
        choiceContainer.appendChild(button);
    }
    
    // Insert the choice UI into the output area
    const outputElement = document.getElementById(`output-${problemIndex}`);
    if (outputElement) {
        // Find the output content area
        let outputContent = outputElement.querySelector('.output-content');
        if (!outputContent) {
            // If no output content exists, create one
            outputContent = document.createElement('div');
            outputContent.className = 'output-content';
            outputElement.appendChild(outputContent);
        }
        
        // Add the choice UI to the output content
        outputContent.appendChild(choiceContainer);
    }
    
    return choiceContainer;
}

/**
 * Sets up the get_input function in the Pyodide environment
 * @param {Object} pyodide - The Pyodide instance
 * @param {Object} problem - The problem configuration object
 * @param {number} problemIndex - The index of the problem
 */
function setupGetInputFunction(pyodide, problem, problemIndex) {
    if (problem.inputs && problem.inputs.length > 0) {
        const getInputFunction = createGetInputFunction(problem, problemIndex);
        pyodide.globals.set('get_input', getInputFunction);
    }
}

/**
 * Sets up the get_choice function in the Pyodide environment
 * @param {Object} pyodide - The Pyodide instance
 * @param {number} problemIndex - The index of the problem
 */
function setupGetChoiceFunction(pyodide, problemIndex) {
    // Create the async JavaScript function that returns a Promise
    const asyncGetChoice = function(n) {
        console.log(`asyncGetChoice ${n}.`);
        // Validate input
        if (!n || n <= 0 || n > 10) {
            console.warn(`Invalid choice count: ${n}. Using 1 as fallback.`);
            return Promise.resolve(1);
        }
        
        // Create choice UI
        const choiceContainer = createChoiceUI(problemIndex, n);
        
        // Return a Promise that resolves when a button is clicked
        return new Promise((resolve) => {
            // Add click handlers to buttons
            for (let i = 1; i <= n; i++) {
                const button = choiceContainer.querySelector(`#choice-${problemIndex}-${i}`);
                if (button) {
                    button.addEventListener('click', () => {
                        // Highlight the selected button briefly
                        button.classList.add('selected');
                        
                        // Remove the choice UI after a short delay
                        setTimeout(() => {
                            if (choiceContainer.parentNode) {
                                choiceContainer.parentNode.removeChild(choiceContainer);
                            }
                        }, 300);
                        
                        // Resolve the Promise with the button number
                        resolve(i);
                    });
                }
            }
        });
    };
    
    // Register the async function directly with Pyodide
    // Pyodide will automatically handle the async/await magic
    pyodide.globals.set('get_choice', asyncGetChoice);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment (for testing)
    module.exports = {
        createGetInputFunction,
        setupGetInputFunction,
        setupGetChoiceFunction,
        createChoiceUI
    };
} else {
    // Browser environment
    window.InputSystem = {
        createGetInputFunction,
        setupGetInputFunction,
        setupGetChoiceFunction,
        createChoiceUI
    };
}
