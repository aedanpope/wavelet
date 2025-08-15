// Shared validation logic for the Python learning platform
// This module contains the validation functions used by both script.js and test files

// Validate the student's answer using validation rules from the problem definition
function validateAnswer(code, output, problem) {
    const codeTrimmed = code.trim();
    const outputTrimmed = output.trim();
    
    // Basic validation checks that apply to all problems
    const codeWithoutComments = codeTrimmed.replace(/#.*$/gm, '').trim();
    if (codeWithoutComments.length < 5) {
        return false;
    }
    
    // Check for common errors that should fail validation
    if (output.includes('NameError') || output.includes('SyntaxError') || 
        output.includes('TypeError') || output.includes('AttributeError') ||
        output.includes('IndentationError') || output.includes('ZeroDivisionError')) {
        return false;
    }
    
    // If no validation rules are defined, use basic validation
    if (!problem.validation || !problem.validation.rules) {
        return codeWithoutComments.length > 10 && outputTrimmed.length > 0;
    }
    
    // Apply validation rules from the problem definition
    const validationRules = problem.validation.rules;
    
    for (const rule of validationRules) {
        const ruleResult = validateRule(code, output, rule);
        if (!ruleResult) {
            console.log(`Validation failed for rule: ${rule.description}`);
            return false;
        }
    }
    
    return true;
}

// Validate a single validation rule
function validateRule(code, output, rule) {
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
            const regexPattern = new RegExp(rule.pattern, 'i'); // case insensitive
            return regexPattern.test(code);
            
        case 'output_contains':
            // Check if pattern is a regex (starts with / and ends with /)
            if (rule.pattern.startsWith('/') && rule.pattern.endsWith('/')) {
                const regexPattern = new RegExp(rule.pattern.slice(1, -1));
                return regexPattern.test(output);
            }
            
            // Special handling for division outputs
            if (rule.pattern.endsWith('.0') && code.includes('/')) {
                // For division problems expecting decimal output, also accept integer output
                const integerVersion = rule.pattern.replace('.0', '');
                return output.includes(rule.pattern) || output.includes(integerVersion);
            }
            return output.includes(rule.pattern);
            
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
            
        default:
            console.warn(`Unknown validation rule type: ${rule.type}`);
            return true;
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
