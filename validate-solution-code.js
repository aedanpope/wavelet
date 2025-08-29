// Enhanced Solution Code Validation System
// Implements seed-based black-box testing with dynamic input generation

// Simple but effective PRNG for deterministic testing
function nextRandom(seed, index = 0) {
    const state = seed * 1000 + index;
    return ((state * 9301 + 49297) % 233280) / 233280;
}

// Override get_choice during test execution
function createTestGetChoice(seed, maxRuns = 10) {
    let choiceIndex = 0;
    const choicesUsed = []; // Track choices made

    const choiceFunction = function(n) {
        const randomValue = nextRandom(seed, choiceIndex);
        const choice = Math.floor(randomValue * n) + 1;
        choicesUsed.push({ choice: choice, maxChoices: n, index: choiceIndex }); // Track
        choiceIndex++;
        return choice;
    };
    choiceFunction.getTrackingData = () => ({ choicesUsed, seed }); // Access tracking data
    return choiceFunction;
}

// Override get_input during test execution
function createTestGetInput(problem, seed, useManualInputs = false) {
    let inputValues;
    if (useManualInputs && problem.inputs && problem.inputs.length > 0) {
        // Manual test case - use actual input values from problem.inputs
        inputValues = {};
        problem.inputs.forEach(input => {
            if (input && input.name) {
                inputValues[input.name] = input.value;
            }
        });
    } else {
        // Seed-based test case - generate values from seed
        inputValues = generateTestValuesFromSeed(problem.inputs, seed);
    }
    
    let inputIndex = 0;
    const inputsUsed = []; // Track inputs used

    const inputFunction = function(inputName) {
        let targetName;
        let value;
        
        if (inputName) {
            // If inputName is provided, use that specific input
            targetName = inputName;
            value = inputValues[inputName];
        } else {
            // If no inputName, return the first input's value (like the real get_input() behavior)
            if (problem.inputs && problem.inputs.length > 0) {
                targetName = problem.inputs[0].name;
                value = inputValues[targetName];
            } else {
                // No inputs defined - this should cause an error to help discover bugs
                targetName = undefined;
                value = undefined;
            }
        }
        
        // Track the input that was used
        inputsUsed.push({
            name: targetName,
            value: value,
            index: inputIndex
        });
        
        inputIndex++;
        return value;
    };
    inputFunction.getTrackingData = () => ({ inputsUsed, seed }); // Access tracking data
    return inputFunction;
}

// Generate test values from seed for deterministic testing
function generateTestValuesFromSeed(inputs, seed) {
    const values = {};
    let currentSeed = seed;
    
    // Handle case where inputs is undefined, null, or not an array
    if (!inputs || !Array.isArray(inputs)) {
        return values;
    }
    
    inputs.forEach(input => {
        if (input && input.name) {
            values[input.name] = generateValueFromSeed(input.type, currentSeed);
            currentSeed = Math.floor(currentSeed / 20) + 1;
        }
    });
    
    return values;
}

// Generate a single test value from seed based on input type
function generateValueFromSeed(type, seed) {
    switch (type) {
        case 'number':
            // Prioritize simple values for low seeds (better error messages)
            const simpleNumbers = [0, 1, 2, 5, 10, -1, -5, 100, -100, 50];
            
            if (seed <= simpleNumbers.length) {
                return simpleNumbers[seed - 1]; // seed 1 = 0, seed 2 = 1, etc.
            } else {
                // For higher seeds, use RNG for more variety
                return Math.floor(nextRandom(seed) * 201) - 100; // -100 to 100
            }
            
        case 'boolean':
            // Simple alternating pattern for low seeds, then RNG
            if (seed <= 2) {
                return seed === 1; // seed 1 = false, seed 2 = true
            } else {
                return nextRandom(seed) < 0.5;
            }
            
        case 'string':
            // Simple strings for low seeds, then RNG
            const simpleStrings = ['hello', 'world', 'test', 'input', 'value', 'data', 'user', 'name', 'code', 'result'];
            
            if (seed <= simpleStrings.length) {
                return simpleStrings[seed - 1];
            } else {
                return simpleStrings[Math.floor(nextRandom(seed) * simpleStrings.length)];
            }
            
        default:
            // Default to simple number pattern
            return seed <= 10 ? seed - 1 : seed % 100;
    }
}

// Execute code with specific seed
async function executeWithSeed(code, problem, seed, pyodideInstance, useManualInputs = false) {
    // Override get_choice and get_input for this test run
    const testGetChoice = createTestGetChoice(seed);
    const testGetInput = createTestGetInput(problem, seed, useManualInputs);
    
    // Set up the test environment
    pyodideInstance.globals.set('get_choice', testGetChoice);
    pyodideInstance.globals.set('get_input', testGetInput);
    
    // Execute and capture output
    let printOutput = '';
    const originalPrint = pyodideInstance.globals.get('print');
    pyodideInstance.globals.set('print', function(...args) {
        printOutput += args.join(' ') + '\n';
    });
    
    try {
        await pyodideInstance.runPythonAsync(code);
        
        // Capture the inputs that were actually used
        const inputTracking = testGetInput.getTrackingData();
        const choiceTracking = testGetChoice.getTrackingData();
        const inputsUsed = {
            inputs: inputTracking.inputsUsed,
            choices: choiceTracking.choicesUsed
        };
        
        return { 
            success: true, 
            output: printOutput, 
            seed,
            inputsUsed: inputsUsed
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message, 
            seed,
            inputsUsed: {
                inputs: testGetInput.getTrackingData().inputsUsed,
                choices: testGetChoice.getTrackingData().choicesUsed
            }
        };
    } finally {
        pyodideInstance.globals.set('print', originalPrint);
    }
}

// Run multiple tests with different seeds
async function runMultipleTests(studentCode, solutionCode, problem, maxRuns, pyodideInstance) {
    const results = [];
    
    for (let seed = 1; seed <= maxRuns; seed++) {
        const studentResult = await executeWithSeed(studentCode, problem, seed, pyodideInstance);
        const solutionResult = await executeWithSeed(solutionCode, problem, seed, pyodideInstance);
        
        // Handle the case where both student and solution code fail with the same error
        const bothFailed = !studentResult.success && !solutionResult.success;
        const sameError = bothFailed && studentResult.error === solutionResult.error;
        
        // Log errors for debugging
        if (bothFailed) {
            console.log(`[ERROR] Both student and solution code failed with error:`, studentResult.error);
        }
        
        results.push({
            seed,
            studentResult,
            solutionResult,
            passed: (studentResult.success && solutionResult.success && 
                   (studentResult.output || '').trim() === (solutionResult.output || '').trim()) ||
                   sameError
        });
    }
    
    return results;
}

// Run manual test cases specified in the validation rule
async function runManualTests(studentCode, solutionCode, rule, problem, pyodideInstance) {
    if (!rule.testInputs || !Array.isArray(rule.testInputs)) {
        return []; // No manual tests specified
    }
    
    const results = [];
    
    for (let i = 0; i < rule.testInputs.length; i++) {
        const testCase = rule.testInputs[i];
        const testInputs = testCase.inputs || {};
        const expectedOutput = testCase.expectedOutput || '';
        
        // Create a modified problem with the test inputs
        const testProblem = {
            ...problem,
            inputs: Object.keys(testInputs).map(name => ({
                name: name,
                value: testInputs[name],
                type: typeof testInputs[name] === 'number' ? 'number' : 
                      typeof testInputs[name] === 'boolean' ? 'boolean' : 'string'
            }))
        };
        
        // Execute both codes with the test inputs
        const studentResult = await executeWithSeed(studentCode, testProblem, 0, pyodideInstance, true);
        const solutionResult = await executeWithSeed(solutionCode, testProblem, 0, pyodideInstance, true);
        
        // Check if outputs match expected
        const studentOutput = (studentResult.output || '').trim();
        const solutionOutput = (solutionResult.output || '').trim();
        
        // Determine if this test case passed
        const passed = studentResult.success && 
                      solutionResult.success && 
                      studentOutput === solutionOutput;
        
        results.push({
            testCaseIndex: i,
            testInputs,
            expectedOutput: solutionOutput,
            studentResult,
            solutionResult,
            passed,
            isManualTest: true
        });
    }
    
    return results;
}

// Calculate test coverage metrics
function calculateCoverage(results) {
    const uniqueOutputs = new Set();
    results.forEach(r => {
        if (r.studentResult.success) {
            uniqueOutputs.add(r.studentResult.output.trim());
        }
    });
    
    return {
        uniqueOutputs: uniqueOutputs.size,
        totalRuns: results.length,
        successRate: results.filter(r => r.studentResult.success).length / results.length
    };
}

// Generate a failure message for a single result
function generateFailureMessage(result, problem) {
    let inputDescription;
    let studentOutput;
    let expectedOutput;
    
    if (result.isManualTest) {
        // Handle manual test cases
        const testInputs = result.testInputs;
        const inputParts = Object.keys(testInputs).map(name => `${name} = ${formatValue(testInputs[name])}`);
        inputDescription = inputParts.length > 0 ? `input ${inputParts.join(', ')}` : null;
        studentOutput = (result.studentResult.output || '').trim();
        expectedOutput = (result.solutionResult.output || '').trim();
    } else {
        // Handle seed-based test cases
        inputDescription = describeInputsForSeed(result.seed, problem, result.studentResult.inputsUsed);
        studentOutput = (result.studentResult.output || '').trim();
        expectedOutput = (result.solutionResult.output || '').trim();
    }
    
    if (inputDescription) {
        return `With ${inputDescription}, your program output: "${studentOutput}" but expected output: "${expectedOutput}"`;
    } else {
        return `Your program output: "${studentOutput}" but expected output: "${expectedOutput}"`;
    }
}

// Generate educational feedback for failures
function generateEducationalFeedback(failedResults, problem) {
    if (failedResults.length === 1) {
        const result = failedResults[0];
        return {
            type: 'specific_failure',
            message: generateFailureMessage(result, problem),
            hint: generateHint(result.seed, result.studentResult.output, result.solutionResult.output, problem)
        };
    } else {
        // Show the first failure scenario for immediate feedback
        const firstFailure = failedResults[0];
        return {
            type: 'multiple_failures',
            message: generateFailureMessage(firstFailure, problem),
            details: failedResults.map(r => `- ${generateFailureMessage(r, problem)}`)
        };
    }
}

// Describe inputs and choices for a specific seed
function describeInputsForSeed(seed, problem, inputsUsed) {
    const parts = [];
    
    // Add get_input values if any were used
    if (inputsUsed.inputs && inputsUsed.inputs.length > 0) {
        const inputParts = inputsUsed.inputs.map(input => {
            if (input.name) {
                return `${input.name} = ${formatValue(input.value)}`;
            } else {
                return formatValue(input.value);
            }
        });
        parts.push(`input ${inputParts.join(', ')}`);
    }
    
    // Add get_choice values if any were used
    if (inputsUsed.choices && inputsUsed.choices.length > 0) {
        const choiceParts = inputsUsed.choices.map(choice => 
            `choice ${choice.choice} (from ${choice.maxChoices} options)`
        );
        parts.push(choiceParts.join(', '));
    }
    
    // Only return meaningful input information, not generic test scenario text
    if (parts.length === 0) {
        return null; // No meaningful inputs to describe
    }
    
    return parts.join(' and ');
}

// Format values for display
function formatValue(value) {
    if (typeof value === 'string') {
        return `"${value}"`;
    }
    return String(value);
}

// Generate hints based on failure patterns
function generateHint(seed, studentOutput, solutionOutput, problem) {
    const studentTrimmed = studentOutput.trim();
    const solutionTrimmed = solutionOutput.trim();
    
    if (studentTrimmed === solutionTrimmed) {
        return "Your output matches the expected output exactly.";
    }
    
    if (studentTrimmed.toLowerCase() === solutionTrimmed.toLowerCase()) {
        return "Check your capitalization - the output should match exactly.";
    }
    
    if (studentTrimmed.includes(solutionTrimmed) || solutionTrimmed.includes(studentTrimmed)) {
        return "Your output is close but not exactly right. Check for extra or missing text.";
    }
    
    if (studentTrimmed.length === 0) {
        return "Your program didn't produce any output. Make sure you have print statements.";
    }
    
    return "Your program's output doesn't match the expected output. Check your logic and print statements.";
}

// Legacy validation approach for backward compatibility
async function validateWithLegacyApproach(studentCode, studentOutput, rule, problem, problemIndex, pyodideInstance) {
    // Get current input values
    const currentInputs = getCurrentInputValues(problem);
    
    // Generate test inputs
    const testInputs = generateTestInputs(problem);
    
    // Test with current inputs
    const currentResult = await testCodeWithInputs(studentCode, currentInputs, problem, pyodideInstance);
    const currentSolutionResult = await testCodeWithInputs(rule.solutionCode, currentInputs, problem, pyodideInstance);
    
    // Handle execution failures
    if (!currentResult.success || !currentSolutionResult.success) {
        // If both fail with the same error, consider it a match
        if (!currentResult.success && !currentSolutionResult.success) {
            return currentResult.error === currentSolutionResult.error;
        }
        console.log('Code execution failed with current inputs');
        return false;
    }
    
    // Test with generated inputs
    const testResult = await testCodeWithInputs(studentCode, testInputs, problem, pyodideInstance);
    const testSolutionResult = await testCodeWithInputs(rule.solutionCode, testInputs, problem, pyodideInstance);
    
    // Handle execution failures
    if (!testResult.success || !testSolutionResult.success) {
        // If both fail with the same error, consider it a match
        if (!testResult.success && !testSolutionResult.success) {
            return testResult.error === testSolutionResult.error;
        }
        console.log('Code execution failed with test inputs');
        return false;
    }
    
    // Compare outputs
    const currentMatch = currentResult.output.trim() === currentSolutionResult.output.trim();
    const testMatch = testResult.output.trim() === testSolutionResult.output.trim();
    
    console.log('currentResult.output.trim():', currentResult.output.trim());
    console.log('currentSolutionResult.output.trim():', currentSolutionResult.output.trim());
    console.log('Current match:', currentMatch);
    console.log('testResult.output.trim():', testResult.output.trim());
    console.log('testSolutionResult.output.trim():', testSolutionResult.output.trim());
    console.log('Test match:', testMatch);
    
    return currentMatch && testMatch;
}

// Legacy helper functions
function getCurrentInputValues(problem) {
    const inputs = {};
    if (problem.inputs) {
        problem.inputs.forEach(input => {
            inputs[input.name] = input.value;
        });
    }
    return inputs;
}

function generateTestInputs(problem) {
    const inputs = {};
    if (problem.inputs) {
        problem.inputs.forEach(input => {
            inputs[input.name] = generateTestValue(input);
        });
    }
    return inputs;
}

function generateTestValue(input) {
    switch (input.type) {
        case 'number':
            return Math.floor(Math.random() * 100);
        case 'string':
            return 'test';
        case 'boolean':
            return Math.random() > 0.5;
        default:
            return input.value;
    }
}

async function testCodeWithInputs(code, inputs, problem, pyodideInstance) {
    try {
        // Set up input values
        Object.keys(inputs).forEach(key => {
            pyodideInstance.globals.set(key, inputs[key]);
        });
        
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
        return { success: false, error: error.message };
    }
}

// Main solution_code validation function
async function validateSolutionCode(studentCode, studentOutput, rule, problem, problemIndex, pyodideInstance) {
    // Check if we should use new seed-based approach
    // if (rule.maxRuns) {
    
    // Run manual test cases if specified
    const manualResults = await runManualTests(studentCode, rule.solutionCode, rule, problem, pyodideInstance);
    
    // Use new seed-based testing
    const maxRuns = rule.maxRuns || 10;
    const seedResults = await runMultipleTests(studentCode, rule.solutionCode, problem, maxRuns, pyodideInstance);
    
    // Combine all results, prioritizing manual test failures
    const allResults = [...manualResults, ...seedResults];
    const failedResults = allResults.filter(r => !r.passed);
    
    if (failedResults.length === 0) {
        return true; // All tests passed
    } else {
        // Generate educational feedback for failures
        const feedback = generateEducationalFeedback(failedResults, problem);
        console.log('Validation failed:', feedback);
        
        // Return enhanced error message for the validation system
        return {
            isValid: false,
            errorType: 'solution_code_validation_failed',
            message: feedback.message
        };
    }
    // } else {
    //     // Use existing approach for backward compatibility
    //     return await validateWithLegacyApproach(studentCode, studentOutput, rule, problem, problemIndex, pyodideInstance);
    // }
}

// Export for use in validation.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateSolutionCode };
} else if (typeof window !== 'undefined') {
    window.SolutionCodeValidator = { validateSolutionCode };
}
