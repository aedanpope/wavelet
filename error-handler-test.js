// Unit tests for error message extraction
// Run with: node test-error-handling.js

// Import the shared error handling logic
const { extractErrorInfo } = require('./error-handler.js');

// Test cases
const testCases = [
    {
        name: "NameError with line number",
        input: `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 571, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 394, in run_async
    coroutine = eval(self.code, globals, locals)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<exec>", line 4, in <module>
NameError: name 'car' is not defined`,
        expected: {
            error: "name 'car' is not defined",
            lineNumber: " (on line 4)",
            fullMessage: "Error: name 'car' is not defined (on line 4)"
        }
    },
    {
        name: "SyntaxError with line number",
        input: `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 571, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 394, in run_async
    coroutine = eval(self.code, globals, locals)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<exec>", line 2, in <module>
SyntaxError: invalid syntax`,
        expected: {
            error: "invalid syntax",
            lineNumber: " (on line 2)",
            fullMessage: "Error: invalid syntax (on line 2)"
        }
    },
    {
        name: "IndentationError with line number",
        input: `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 571, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 394, in run_async
    coroutine = eval(self.code, globals, locals)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<exec>", line 3, in <module>
IndentationError: expected an indented block`,
        expected: {
            error: "expected an indented block",
            lineNumber: " (on line 3)",
            fullMessage: "Error: expected an indented block (on line 3)"
        }
    },
    {
        name: "TypeError with line number",
        input: `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 571, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 394, in run_async
    coroutine = eval(self.code, globals, locals)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<exec>", line 5, in <module>
TypeError: unsupported operand type(s) for +: 'int' and 'str'`,
        expected: {
            error: "unsupported operand type(s) for +: 'int' and 'str'",
            lineNumber: " (on line 5)",
            fullMessage: "Error: unsupported operand type(s) for +: 'int' and 'str' (on line 5)"
        }
    },
    {
        name: "ZeroDivisionError with line number",
        input: `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 571, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 394, in run_async
    coroutine = eval(self.code, globals, locals)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<exec>", line 1, in <module>
ZeroDivisionError: division by zero`,
        expected: {
            error: "division by zero",
            lineNumber: " (on line 1)",
            fullMessage: "Error: division by zero (on line 1)"
        }
    },
    {
        name: "Simple error without traceback",
        input: "NameError: name 'x' is not defined",
        expected: {
            error: "NameError: name 'x' is not defined",
            lineNumber: "",
            fullMessage: "Error: NameError: name 'x' is not defined"
        }
    },
    {
        name: "Custom error message",
        input: "Custom error message",
        expected: {
            error: "Custom error message",
            lineNumber: "",
            fullMessage: "Error: Custom error message"
        }
    }
];

// Run tests
function runTests() {
    console.log("🧪 Running Error Handling Tests\n");
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach((testCase, index) => {
        console.log(`Test ${index + 1}: ${testCase.name}`);
        
        try {
            const result = extractErrorInfo(testCase.input);
            
            // Check if all expected properties match
            const errorMatch = result.error === testCase.expected.error;
            const lineMatch = result.lineNumber === testCase.expected.lineNumber;
            const fullMatch = result.fullMessage === testCase.expected.fullMessage;
            
            if (errorMatch && lineMatch && fullMatch) {
                console.log("✅ PASSED");
                console.log(`   Input: ${testCase.input.split('\n')[0]}...`);
                console.log(`   Output: ${result.fullMessage}`);
                passed++;
            } else {
                console.log("❌ FAILED");
                console.log(`   Expected: ${testCase.expected.fullMessage}`);
                console.log(`   Got:      ${result.fullMessage}`);
                console.log(`   Error match: ${errorMatch}, Line match: ${lineMatch}, Full match: ${fullMatch}`);
                failed++;
            }
        } catch (error) {
            console.log("❌ FAILED - Exception thrown");
            console.log(`   Error: ${error.message}`);
            failed++;
        }
        
        console.log("");
    });
    
    // Summary
    console.log("📊 Test Summary");
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log("\n🎉 All tests passed!");
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed. Please check the error handling logic.`);
    }
}

// Run the tests
runTests();
