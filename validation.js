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
        
        if (typeof ruleResult === 'object' && ruleResult.isValid === false) {
            // Rule failed - return the detailed error message
            console.log(`Validation failed for rule: ${rule.type} - ${rule.pattern}`);
            return {
                isValid: ruleResult.isValid,
                errorType: ruleResult.errorType,
                message: '❌ ' + ruleResult.message
            };
        }
        // ruleResult === true or { isValid: true } - continue to next rule
    }
    
    // If we get here, validation passed
    return {
        isValid: true,
        errorType: null,
        message: '✅ Correct! Well done!'
    };
}



// Validate a single validation rule
// Returns detailed error message objects for better educational feedback
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
            
            if (!result) {
                // Generate appropriate error message
                let message;
                if (rule.description) {
                    message = rule.description;
                } else if (rule.pattern === 'int(') {
                    message = "Code must contain an int() function call";
                } else if (rule.pattern === 'print') {
                    message = "Code must contain a print statement";
                } else if (rule.pattern === '+') {
                    message = "Code must contain the addition operator (+)";
                } else if (rule.pattern === '-') {
                    message = "Code must contain the subtraction operator (-)";
                } else if (rule.pattern === '*') {
                    message = "Code must contain the multiplication operator (*)";
                } else if (rule.pattern === '/') {
                    message = "Code must contain the division operator (/)";
                } else if (rule.pattern === '(') {
                    message = "Code must contain an opening parenthesis";
                } else if (rule.pattern === ')') {
                    message = "Code must contain a closing parenthesis";
                } else if (/^\d+$/.test(rule.pattern)) {
                    message = `Code must contain the number ${rule.pattern}`;
                } else {
                    message = `Code must contain '${rule.pattern}'`;
                }
                
                return {
                    isValid: false,
                    errorType: 'code_contains_failed',
                    message: message
                };
            }
            return { isValid: true };
            
        case 'code_contains_regex':
            const codeRegexPattern = new RegExp(rule.pattern, 'i'); // case insensitive
            const regexResult = codeRegexPattern.test(code);
            
            if (!regexResult) {
                let message;
                if (rule.description) {
                    message = rule.description;
                } else {
                    // Try to make the regex pattern more readable
                    let readablePattern = rule.pattern
                        .replace(/\\s\*/g, ' ')  // Replace \s* with space
                        .replace(/\\s\+/g, ' ')  // Replace \s+ with space
                        .replace(/\\s/g, ' ')    // Replace \s with space
                        .replace(/\\\(/g, '(')   // Replace \( with (
                        .replace(/\\\)/g, ')')   // Replace \) with )
                        .replace(/\\\+/g, '+')   // Replace \+ with +
                        .replace(/\\\-/g, '-')   // Replace \- with -
                        .replace(/\\\*/g, '*')   // Replace \* with *
                        .replace(/\\\//g, '/')   // Replace \/ with /
                        .replace(/\\\./g, '.')   // Replace \. with .
                        .replace(/\s+/g, ' ')    // Normalize multiple spaces
                        .trim();
                    
                    message = `Code must contain: ${readablePattern}`;
                }
                
                return {
                    isValid: false,
                    errorType: 'code_contains_regex_failed',
                    message: message
                };
            }
            return { isValid: true };
            
        case 'output_contains':
            const outputResult = normalizeNumericalComparison(output, rule.pattern);
            
            if (!outputResult) {
                let message;
                if (rule.description) {
                    message = rule.description;
                } else {
                    message = `Output must contain '${rule.pattern}'`;
                }
                
                return {
                    isValid: false,
                    errorType: 'output_contains_failed',
                    message: message
                };
            }
            return { isValid: true };
            
        case 'output_contains_regex':
            const outputRegexPattern = new RegExp(rule.pattern, 'i'); // case insensitive
            const outputRegexResult = outputRegexPattern.test(output);
            
            if (!outputRegexResult) {
                let message;
                if (rule.description) {
                    message = rule.description;
                } else {
                    message = `Output must match pattern '${rule.pattern}'`;
                }
                
                return {
                    isValid: false,
                    errorType: 'output_contains_regex_failed',
                    message: message
                };
            }
            return { isValid: true };
            
        case 'code_min_length':
            const codeWithoutComments = code.replace(/#.*$/gm, '').trim();
            const lengthResult = codeWithoutComments.length >= rule.minLength;
            
            if (!lengthResult) {
                return {
                    isValid: false,
                    errorType: 'code_min_length_failed',
                    message: `Code must be at least ${rule.minLength} characters long`
                };
            }
            return { isValid: true };
            
        case 'output_not_empty':
            const emptyResult = output.trim().length > 0;
            
            if (!emptyResult) {
                return {
                    isValid: false,
                    errorType: 'output_not_empty_failed',
                    message: "Your program should produce some output"
                };
            }
            return { isValid: true };
            
        case 'no_errors':
            const noErrorsResult = !output.includes('Error') && !output.includes('Traceback');
            
            if (!noErrorsResult) {
                return {
                    isValid: false,
                    errorType: 'no_errors_failed',
                    message: "Your program should not produce any errors"
                };
            }
            return { isValid: true };
            
        case 'print_count':
            const printMatches = code.match(/print\(/g) || [];
            const printCountResult = printMatches.length >= rule.minCount;
            
            if (!printCountResult) {
                return {
                    isValid: false,
                    errorType: 'print_count_failed',
                    message: `Code must contain at least ${rule.minCount} print statement(s)`
                };
            }
            return { isValid: true };
            
        case 'output_line_count':
            const lines = output.split('\n').filter(line => line.trim());
            const lineCountResult = lines.length >= rule.minLines;
            
            if (!lineCountResult) {
                return {
                    isValid: false,
                    errorType: 'output_line_count_failed',
                    message: `Output must contain at least ${rule.minLines} line(s)`
                };
            }
            return { isValid: true };
            
        case 'code_contains_number':
            const numberRegex = new RegExp(rule.pattern);
            const numberResult = numberRegex.test(code);
            
            if (!numberResult) {
                return {
                    isValid: false,
                    errorType: 'code_contains_number_failed',
                    message: `Code must contain the number ${rule.pattern}`
                };
            }
            return { isValid: true };
            
        case 'output_is_number':
            const outputLines = output.split('\n').filter(line => line.trim());
            const isNumberResult = outputLines.length > 0 && !isNaN(Number(outputLines[0]));
            
            if (!isNumberResult) {
                return {
                    isValid: false,
                    errorType: 'output_is_number_failed',
                    message: "Output should be a number"
                };
            }
            return { isValid: true };
            
        case 'assignment_count':
            const assignmentMatches = code.match(/=/g) || [];
            const assignmentResult = assignmentMatches.length >= rule.minCount;
            
            if (!assignmentResult) {
                return {
                    isValid: false,
                    errorType: 'assignment_count_failed',
                    message: `Code must contain at least ${rule.minCount} assignment(s)`
                };
            }
            return { isValid: true };
            
        case 'input_count':
            const inputMatches = code.match(/input\(/g) || [];
            const inputResult = inputMatches.length >= rule.minCount;
            
            if (!inputResult) {
                return {
                    isValid: false,
                    errorType: 'input_count_failed',
                    message: `Code must contain at least ${rule.minCount} input statement(s)`
                };
            }
            return { isValid: true };
            
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
                return {
                    isValid: false,
                    errorType: 'solution_code_validator_unavailable',
                    message: "Solution code validation is not available"
                };
            }
            
        default:
            console.warn(`Unknown validation rule type: ${rule.type}`);
            return { isValid: true };
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
