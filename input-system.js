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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment (for testing)
    module.exports = {
        createGetInputFunction,
        setupGetInputFunction
    };
} else {
    // Browser environment
    window.InputSystem = {
        createGetInputFunction,
        setupGetInputFunction
    };
}
