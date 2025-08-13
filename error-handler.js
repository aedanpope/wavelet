// Shared error handling logic for Python learning platform
// This module provides consistent error message extraction across the application

/**
 * Extracts clean error information from Python error messages
 * @param {string} errorMessage - The raw error message from Python
 * @returns {Object} Object containing error, lineNumber, and fullMessage
 */
function extractErrorInfo(errorMessage) {
    let cleanError = errorMessage;
    let lineNumber = '';
    
    // If it's a Python error with traceback, extract error and line number
    if (errorMessage.includes('Traceback')) {
        const lines = errorMessage.split('\n');
        
        // Find the line that shows the error location (contains "<exec>")
        const execLine = lines.find(line => line.includes('<exec>'));
        if (execLine) {
            // Extract line number from "<exec>", line X, in <module>
            const lineMatch = execLine.match(/line (\d+)/);
            if (lineMatch) {
                lineNumber = ` (on line ${lineMatch[1]})`;
            }
        }
        
        // Find the last line that contains an error type (contains 'Error:')
        const errorLine = lines.find(line => 
            line.includes('Error:')
        );
        if (errorLine) {
            // Extract the error message from the error line
            // Format is typically "ErrorType: error message"
            const colonIndex = errorLine.indexOf(':');
            if (colonIndex !== -1) {
                cleanError = errorLine.substring(colonIndex + 1).trim();
            }
        }
    }
    
    return {
        error: cleanError,
        lineNumber: lineNumber,
        fullMessage: `Error: ${cleanError}${lineNumber}`
    };
}

// Export for Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractErrorInfo };
}

// Export for browser (ES6 modules)
if (typeof window !== 'undefined') {
    window.ErrorHandler = { extractErrorInfo };
}
