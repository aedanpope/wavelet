// Standalone solution_code validation module
// Extracted from validation.js as a no-op refactor

// Get current input values from the student's run
function getCurrentInputValues(problem, problemIndex) {
    const inputs = {};
    if (problem.inputs) {
        for (const input of problem.inputs) {
            const inputElement = document.getElementById(`input-${problemIndex}-${input.name}`);
            if (inputElement) {
                let value = inputElement.value;
                if (input.type === 'number') {
                    value = parseFloat(value) || 0;
                }
                inputs[input.name] = value;
            }
        }
    }
    return inputs;
}

// Generate test input values
function generateTestInputs(problem) {
    const inputs = {};
    if (problem.inputs) {
        for (let i = 0; i < problem.inputs.length; i++) {
            const input = problem.inputs[i];
            // Use (i * 17) + 31 for variety and noise
            const testValue = (i * 17) + 31;
            inputs[input.name] = testValue;
        }
    }
    return inputs;
}

// Test code with specific input values
async function testCodeWithInputs(code, inputValues, problem, pyodideInstance) {
    try {
        if (!pyodideInstance) {
            console.error('Pyodide instance not available');
            return { success: false, output: '', error: 'Pyodide not available' };
        }
        
        // Create a mock get_input function for testing
        const mockGetInput = function(inputName) {
            if (inputName === undefined || inputName === null) {
                // Return first input value if no argument provided
                const firstInputName = Object.keys(inputValues)[0];
                return firstInputName ? inputValues[firstInputName] : null;
            }
            return inputValues[inputName] || null;
        };
        
        // Set up the mock get_input function
        pyodideInstance.globals.set('get_input', mockGetInput);
        
        // Capture print output
        let printOutput = '';
        const originalPrint = pyodideInstance.globals.get('print');
        pyodideInstance.globals.set('print', function(...args) {
            printOutput += args.join(' ') + '\n';
        });
        
        // Run the code
        await pyodideInstance.runPythonAsync(code);
        pyodideInstance.globals.set('print', originalPrint);
        
        return { success: true, output: printOutput };
        
    } catch (error) {
        console.error('Error testing code with inputs:', error);
        return { success: false, output: '', error: error.message };
    }
}

// Validate student code against a solution program
async function validateSolutionCode(studentCode, studentOutput, rule, problem, problemIndex, pyodideInstance) {
    try {
        const solutionCode = rule.solutionCode;
        if (!solutionCode) {
            console.warn('Solution code not provided for solution_code validation rule');
            return false;
        }
        
        // Get the current input values from the student's run
        const currentInputs = getCurrentInputValues(problem, problemIndex);
        
        // Generate test inputs (i * 17 + 31 for each input)
        const testInputs = generateTestInputs(problem);
        
        // Test with current inputs
        const currentResult = await testCodeWithInputs(studentCode, currentInputs, problem, pyodideInstance);
        const currentSolutionResult = await testCodeWithInputs(solutionCode, currentInputs, problem, pyodideInstance);
        
        // Test with generated inputs
        const testResult = await testCodeWithInputs(studentCode, testInputs, problem, pyodideInstance);
        const testSolutionResult = await testCodeWithInputs(solutionCode, testInputs, problem, pyodideInstance);
        
        // Handle cases where both student and solution code fail
        const currentBothFailed = !currentResult.success && !currentSolutionResult.success;
        const testBothFailed = !testResult.success && !testSolutionResult.success;
        
        if (currentBothFailed && testBothFailed) {
            // Both failed in both test scenarios - this is acceptable if they fail the same way
            console.log('Both student and solution code failed in both scenarios');
            return true;
        }
        
        if (!currentResult.success || !currentSolutionResult.success) {
            console.log('Code execution failed with current inputs');
            return false;
        }
        
        if (!testResult.success || !testSolutionResult.success) {
            console.log('Code execution failed with test inputs');
            return false;
        }
        
        // Compare outputs - both current and test inputs should match
        const currentMatch = currentResult.output.trim() === currentSolutionResult.output.trim();
        console.log('currentResult.output.trim():', currentResult.output.trim());
        console.log('currentSolutionResult.output.trim():', currentSolutionResult.output.trim());
        console.log('Current match:', currentMatch);
        const testMatch = testResult.output.trim() === testSolutionResult.output.trim();
        console.log('Test match:', testMatch);
        
        return currentMatch && testMatch;
        
    } catch (error) {
        console.error('Error in solution_code validation:', error);
        return false;
    }
}

// Export for use in validation.js
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment (for tests)
    module.exports = { validateSolutionCode };
} else if (typeof window !== 'undefined') {
    // Browser environment (for production)
    window.SolutionCodeValidator = { validateSolutionCode };
}
