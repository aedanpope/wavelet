// Shared validation logic for the Python learning platform
// This module contains the validation functions used by both script.js and test files

// Helper function to normalize numerical comparisons
function normalizeNumericalComparison(output, pattern) {
    // Normalize numerical comparisons for all operations
    if (/^\d+\.0$/.test(pattern)) {
        // For any numerical pattern ending in .0, also accept integer output
        const integerVersion = pattern.replace('.0', '');
        return output.includes(pattern) || output.includes(integerVersion);
    }
    return output.includes(pattern);
}

// Validate the student's answer using validation rules from the problem definition
async function validateAnswer(code, output, problem, problemIndex) {
    const codeTrimmed = code.trim();
    const outputTrimmed = output.trim();
    
    // Basic validation checks that apply to all problems
    const codeWithoutComments = codeTrimmed.replace(/#.*$/gm, '').trim();
    if (codeWithoutComments.length < 3) {
        return {
            isValid: false,
            errorType: 'insufficient_code',
            message: 'Please enter more code to run.'
        };
    }
    
    // Check for common errors that should fail validation
    if (output.includes('NameError') || output.includes('SyntaxError') || 
        output.includes('TypeError') || output.includes('AttributeError') ||
        output.includes('IndentationError') || output.includes('ZeroDivisionError')) {
        return {
            isValid: false,
            errorType: 'python_error',
            message: '❌ There was an error running your code.'
        };
    }
    
    // If no validation rules are defined, use basic validation
    if (!problem.validation || !problem.validation.rules) {
        const isValid = codeWithoutComments.length > 10 && outputTrimmed.length > 0;
        return {
            isValid,
            errorType: isValid ? null : 'basic_validation_failed',
            message: isValid ? '✅ Correct! Well done!' : '❌ Not quite right! Check the task requirements and try again.'
        };
    }
    
    // Apply validation rules from the problem definition
    const validationRules = problem.validation.rules;
    
    for (const rule of validationRules) {
        const ruleResult = await validateRule(code, output, rule, problem, problemIndex);
        if (!ruleResult) {
            console.log(`Validation failed for rule: ${rule.type} - ${rule.pattern}`);
            // Use helpful error message generation instead of generic message
            return generateHelpfulErrorMessage(code, output, problem, rule);
        }
    }
    
    // If we get here, validation passed
    return {
        isValid: true,
        errorType: null,
        message: '✅ Correct! Well done!'
    };
}

// Generate helpful error messages for specific common cases
function generateHelpfulErrorMessage(code, output, problem, failedRule) {
    const outputTrimmed = output.trim();
    
    // Check for missing output when there should be some
    if (!outputTrimmed) {
        // Only suggest print() if there's an expected output rule
        const hasExpectedOutput = problem.validation.rules.some(rule => 
            rule.type === 'output_contains' || rule.type === 'output_contains_regex'
        );
        if (hasExpectedOutput) {
            return {
                isValid: false,
                errorType: 'missing_print',
                message: '❌ Your program should produce some output. Try adding a print() statement.'
            };
        }
    }
    
    // Check for wrong numerical output - but only if the failed rule was an output rule
    if (outputTrimmed && /^\d+(\.\d+)?$/.test(outputTrimmed) && 
        failedRule && failedRule.type === 'output_contains' && /^\d+(\.\d+)?$/.test(failedRule.pattern)) {
        // Apply the same normalization logic as in validateRule
        const outputMatches = normalizeNumericalComparison(outputTrimmed, failedRule.pattern);
        
        if (!outputMatches) {
            return {
                isValid: false,
                errorType: 'wrong_number',
                message: `❌ Expected output: ${failedRule.pattern}, but your program output: ${outputTrimmed}`
            };
        }
    }
    
    // Default error message
    return {
        isValid: false,
        errorType: 'general_error',
        message: '❌ Not quite right! Check the task requirements and try again.'
    };
}

// Validate a single validation rule
async function validateRule(code, output, rule, problem, problemIndex) {
    switch (rule.type) {
        case 'code_contains':
            let result;
            if (rule.pattern === 'int(') {
                // More precise check for int() function call
                result = /\bint\s*\(/.test(code);
            } else {
                result = code.includes(rule.pattern);
            }
            return result;
            
        case 'code_contains_regex':
            const codeRegexPattern = new RegExp(rule.pattern, 'i'); // case insensitive
            return codeRegexPattern.test(code);
            
        case 'output_contains':
            return normalizeNumericalComparison(output, rule.pattern);
            
        case 'output_contains_regex':
            const outputRegexPattern = new RegExp(rule.pattern, 'i'); // case insensitive
            return outputRegexPattern.test(output);
            
        case 'code_min_length':
            const codeWithoutComments = code.replace(/#.*$/gm, '').trim();
            return codeWithoutComments.length >= rule.minLength;
            
        case 'output_not_empty':
            return output.trim().length > 0;
            
        case 'no_errors':
            return !output.includes('Error') && !output.includes('Traceback');
            
        case 'print_count':
            const printMatches = code.match(/print\(/g) || [];
            return printMatches.length >= rule.minCount;
            
        case 'output_line_count':
            const lines = output.split('\n').filter(line => line.trim());
            return lines.length >= rule.minLines;
            
        case 'code_contains_number':
            const regex = new RegExp(rule.pattern);
            return regex.test(code);
            
        case 'output_is_number':
            const outputLines = output.split('\n').filter(line => line.trim());
            return outputLines.length > 0 && !isNaN(Number(outputLines[0]));
            
        case 'assignment_count':
            const assignmentMatches = code.match(/=/g) || [];
            return assignmentMatches.length >= rule.minCount;
            
        case 'input_count':
            const inputMatches = code.match(/input\(/g) || [];
            return inputMatches.length >= rule.minCount;
            
        case 'solution_code':
            return await validateSolutionCode(code, output, rule, problem, problemIndex);
            
        default:
            console.warn(`Unknown validation rule type: ${rule.type}`);
            return true;
    }
}

// Validate student code against a solution program
async function validateSolutionCode(studentCode, studentOutput, rule, problem, problemIndex) {
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
        const currentResult = await testCodeWithInputs(studentCode, currentInputs, problem);
        const currentSolutionResult = await testCodeWithInputs(solutionCode, currentInputs, problem);
        
        if (!currentResult.success || !currentSolutionResult.success) {
            console.log('Code execution failed with current inputs');
            return false;
        }
        
        // Test with generated inputs
        const testResult = await testCodeWithInputs(studentCode, testInputs, problem);
        const testSolutionResult = await testCodeWithInputs(solutionCode, testInputs, problem);
        
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
async function testCodeWithInputs(code, inputValues, problem) {
    try {
        // Get the global pyodide instance
        const pyodideInstance = window.pyodide || pyodide;
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment (for tests)
    module.exports = { validateAnswer };
} else if (typeof window !== 'undefined') {
    // Browser environment (for production)
    window.Validation = { validateAnswer };
}
