// Shared validation logic for the Python learning platform
// This module contains the validation functions used by both script.js and test files

// Import solution_code validation from standalone module
// Note: In browser environment, this will be loaded via script tag before validation.js
// AST validator is also loaded via script tag (ast-validator.js) before this file

// Helper function to normalize numerical comparisons with case-insensitive text matching
function normalizeNumericalComparison(output, pattern) {
    // Normalize numerical comparisons for all operations
    if (/^\d+\.0$/.test(pattern)) {
        // For any numerical pattern ending in .0, also accept integer output
        const integerVersion = pattern.replace('.0', '');
        return output.includes(pattern) || output.includes(integerVersion);
    }
    
    // Make all text matching case-insensitive
    return output.toLowerCase().includes(pattern.toLowerCase());
}

// Validate the student's answer using validation rules from the problem definition
async function validateAnswer(code, output, problem, problemIndex, codeExecutor, userInputValues = {}) {
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

    // Parse AST once if any ast_* rules exist (reused by all ast rules)
    let astData = null;
    const hasASTRules = validationRules.some(r => r.type.startsWith('ast_'));
    if (hasASTRules && codeExecutor) {
        const astParser = (typeof window !== 'undefined' && window.ASTValidator)
            ? window.ASTValidator
            : (typeof require !== 'undefined' ? require('./ast-validator.js') : null);
        if (astParser) {
            astData = await astParser.parseStudentAST(codeTrimmed, codeExecutor.getPyodide());
        }
    }

    for (const rule of validationRules) {
        const ruleResult = await validateRule(code, output, rule, problem, problemIndex, codeExecutor, userInputValues, astData);
        
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
async function validateRule(code, output, rule, problem, problemIndex, codeExecutor, userInputValues = {}, astData = null) {
    // Delegate ast_* rules to the AST validator module
    if (rule.type.startsWith('ast_')) {
        const astValidator = (typeof window !== 'undefined' && window.ASTValidator)
            ? window.ASTValidator
            : (typeof require !== 'undefined' ? require('./ast-validator.js') : null);
        if (astValidator) {
            return astValidator.validateASTRule(astData, rule);
        }
        return { isValid: true }; // graceful fallback if module unavailable
    }

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
                let errorType = 'code_contains_failed';
                
                if (rule.description) {
                    message = rule.description;
                } else {
                    if (rule.pattern === 'int(') {
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
                }
                
                return {
                    isValid: false,
                    errorType: errorType,
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
                let errorType = 'output_contains_failed';
                
                if (rule.description) {
                    message = rule.description;
                } else {
                    // Special case: if output is empty and we expected output, suggest adding print()
                    if (output.trim() === '') {
                        errorType = 'missing_print';
                        message = 'Your program should produce some output. Try adding a print() statement.';
                    }
                    // Special case: if output is a different number than expected
                    else if (/^\d+(\.\d+)?\n?$/.test(output.trim()) && /^\d+(\.\d+)?$/.test(rule.pattern)) {
                        errorType = 'wrong_number';
                        message = `Expected output: ${rule.pattern}, but your program output: ${output.trim()}`;
                    }
                    else {
                        message = `Output must contain \n'${rule.pattern}'`;
                    }
                }
                
                return {
                    isValid: false,
                    errorType: errorType,
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
            
        case 'function_spec':
            return await validateFunctionSpec(code, rule, codeExecutor);

        case 'function_buttons':
            return await validateFunctionButtons(code, rule, codeExecutor);

        case 'solution_code':
            // Use the imported validateSolutionCode function
            if (typeof window !== 'undefined' && window.SolutionCodeValidator) {
                return await window.SolutionCodeValidator.validateSolutionCode(code, output, rule, problem, problemIndex, codeExecutor, userInputValues);
            } else if (typeof module !== 'undefined' && module.exports) {
                // Node.js environment - import dynamically
                const { validateSolutionCode } = require('./validate-solution-code.js');
                return await validateSolutionCode(code, output, rule, problem, problemIndex, codeExecutor, userInputValues);
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

// Format a JS value the way Python would render it. Mirrors ProblemRenderer.pyRepr
// but kept local so validation tests can run in Node without DOM dependencies.
function reprForFeedback(v) {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'string') return '"' + v + '"';
    if (Array.isArray(v)) return '[' + v.map(reprForFeedback).join(', ') + ']';
    return String(v);
}

function valuesEqualForSpec(a, b) {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((x, i) => valuesEqualForSpec(x, b[i]));
    }
    return false;
}

function unwrapPyVal(val) {
    if (val == null) return null;
    if (typeof val === 'object' && typeof val.toJs === 'function') {
        const js = val.toJs();
        if (typeof val.destroy === 'function') val.destroy();
        return js;
    }
    return val;
}

// Validate a function_spec rule. Resets the Python env, runs the student's
// code so the function is defined, then calls it once per case and compares
// the return value to `expected`. First failure wins.
async function validateFunctionSpec(code, rule, codeExecutor) {
    if (!codeExecutor || !codeExecutor.getPyodide) {
        return { isValid: false, errorType: 'function_spec_unavailable', message: 'Spec validation is not available' };
    }
    const pyodide = codeExecutor.getPyodide();

    try {
        await codeExecutor.resetPythonEnvironment();
    } catch (_) { /* keep going */ }

    // Suppress prints during validation; the spec only checks return values.
    const origPrint = pyodide.globals.get('print');
    pyodide.globals.set('print', () => {});
    try {
        try {
            await pyodide.runPythonAsync(code);
        } catch (e) {
            return { isValid: false, errorType: 'function_spec_runtime', message: 'Your code had an error before the function could be tested: ' + (e.message || e) };
        }

        const fn = pyodide.globals.get(rule.functionName);
        if (!fn) {
            return { isValid: false, errorType: 'function_spec_missing', message: `Define a function called \`${rule.functionName}\`.` };
        }

        for (const c of rule.cases) {
            let actual;
            try {
                actual = unwrapPyVal(fn(...c.args));
            } catch (e) {
                if (typeof fn.destroy === 'function') fn.destroy();
                return { isValid: false, errorType: 'function_spec_call_error', message: `${rule.functionName}(${c.args.map(reprForFeedback).join(', ')}) raised an error: ${e.message || e}` };
            }
            if (!valuesEqualForSpec(actual, c.expected)) {
                if (typeof fn.destroy === 'function') fn.destroy();
                return {
                    isValid: false,
                    errorType: 'function_spec_mismatch',
                    message: `Spec failed: ${rule.functionName}(${c.args.map(reprForFeedback).join(', ')}) returned ${reprForFeedback(actual)}, but expected ${reprForFeedback(c.expected)}.`
                };
            }
        }
        if (typeof fn.destroy === 'function') fn.destroy();
        return { isValid: true };
    } finally {
        pyodide.globals.set('print', origPrint);
    }
}

// Validate a function_buttons rule. Runs the student's code AND the solution
// code each in fresh envs, then runs each `call` expression in both, comparing
// captured print output. Anything else (e.g. missing function) shows up as a
// runtime error in the student env.
async function validateFunctionButtons(code, rule, codeExecutor) {
    if (!codeExecutor || !codeExecutor.getPyodide) {
        return { isValid: false, errorType: 'function_buttons_unavailable', message: 'Button validation is not available' };
    }
    const pyodide = codeExecutor.getPyodide();

    async function runAndCapture(setupCode, callExpr) {
        try { await codeExecutor.resetPythonEnvironment(); } catch (_) {}
        const origPrint = pyodide.globals.get('print');
        let out = '';
        const pyStr = a => a === true ? 'True' : a === false ? 'False' : a == null ? 'None' : String(a);
        pyodide.globals.set('print', (...args) => { out += args.map(pyStr).join(' ') + '\n'; });
        try {
            await pyodide.runPythonAsync(setupCode);
            await pyodide.runPythonAsync(callExpr);
            return { ok: true, output: out.trim() };
        } catch (e) {
            return { ok: false, error: e.message || String(e), output: out.trim() };
        } finally {
            pyodide.globals.set('print', origPrint);
        }
    }

    for (const call of rule.calls) {
        const studentResult = await runAndCapture(code, call);
        const solutionResult = await runAndCapture(rule.solutionCode, call);
        if (!solutionResult.ok) {
            // Solution code itself broke — bug in worksheet, fail loud
            return { isValid: false, errorType: 'function_buttons_solution_error', message: `Worksheet bug: solution code errored on \`${call}\`: ${solutionResult.error}` };
        }
        if (!studentResult.ok) {
            return { isValid: false, errorType: 'function_buttons_student_error', message: `\`${call}\` raised an error in your code: ${studentResult.error}` };
        }
        if (studentResult.output !== solutionResult.output) {
            return {
                isValid: false,
                errorType: 'function_buttons_mismatch',
                message: `\`${call}\` printed:\n${studentResult.output || '(nothing)'}\nbut expected:\n${solutionResult.output || '(nothing)'}`
            };
        }
    }
    return { isValid: true };
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
