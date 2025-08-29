// Shared validation logic for the Python learning platform
// This module contains the validation functions used by both script.js and test files

// Import solution_code validation from standalone module
// Note: In browser environment, this will be loaded via script tag before validation.js

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
async function validateAnswer(code, output, problem, problemIndex, pyodideInstance) {
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
        const ruleResult = await validateRule(code, output, rule, problem, problemIndex, pyodideInstance);
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
    
    // Check if the failed rule has a custom message
    if (failedRule && failedRule.message) {
        return {
            isValid: false,
            errorType: 'custom_message',
            message: '❌ ' + failedRule.message
        };
    }
    
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
async function validateRule(code, output, rule, problem, problemIndex, pyodideInstance) {
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
            // Use the imported validateSolutionCode function
            if (typeof window !== 'undefined' && window.SolutionCodeValidator) {
                return await window.SolutionCodeValidator.validateSolutionCode(code, output, rule, problem, problemIndex, pyodideInstance);
            } else if (typeof module !== 'undefined' && module.exports) {
                // Node.js environment - import dynamically
                const { validateSolutionCode } = require('./validate-solution-code.js');
                return await validateSolutionCode(code, output, rule, problem, problemIndex, pyodideInstance);
            } else {
                console.error('SolutionCodeValidator not available');
                return false;
            }
            
        default:
            console.warn(`Unknown validation rule type: ${rule.type}`);
            return true;
    }
}

// Note: validateSolutionCode and related functions have been moved to validate-solution-code.js

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment (for tests)
    module.exports = { validateAnswer };
} else if (typeof window !== 'undefined') {
    // Browser environment (for production)
    window.Validation = { validateAnswer };
}
