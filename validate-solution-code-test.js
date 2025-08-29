// Test script for solution_code validation using actual Pyodide
// This tests the Python/JavaScript boundary and more advanced validation scenarios

// Import the solution code validator directly
const { validateSolutionCode } = require('./validate-solution-code.js');

// Initialize Pyodide
let pyodideInstance = null;

async function initializePyodide() {
    if (typeof window !== 'undefined') {
        // Browser environment - Pyodide should already be loaded
        pyodideInstance = window.pyodide;
    } else {
        // Node.js environment - load real Pyodide from node_modules
        console.log('Loading Pyodide from node_modules...');
        const { loadPyodide } = require('pyodide');
        pyodideInstance = await loadPyodide({
            indexURL: "./node_modules/pyodide/"
        });
        console.log('Pyodide loaded successfully');
    }
}

// Test cases for solution_code validation
const testCases = [
    {
        name: "Simple print statement - exact match (should pass)",
        studentCode: 'print("Hello, World!")',
        solutionCode: 'print("Hello, World!")',
        expected: true
    },
    {
        name: "Simple print statement - different output (should fail)",
        studentCode: 'print("Hello, Python!")',
        solutionCode: 'print("Hello, World!")',
        expected: false
    },
    {
        name: "Variable assignment - same variable name (should pass)",
        studentCode: 'name = "Alice"\nprint("Hello, " + name)',
        solutionCode: 'name = "Alice"\nprint("Hello, " + name)',
        expected: true
    },
    {
        name: "Variable assignment - different variable name (should pass)",
        studentCode: 'person = "Alice"\nprint("Hello, " + person)',
        solutionCode: 'name = "Alice"\nprint("Hello, " + name)',
        expected: true
    },
    {
        name: "Variable assignment - different value (should fail)",
        studentCode: 'name = "Bob"\nprint("Hello, " + name)',
        solutionCode: 'name = "Alice"\nprint("Hello, " + name)',
        expected: false
    },
    {
        name: "Math calculation - same logic (should pass)",
        studentCode: 'result = 10 + 5\nprint(result)',
        solutionCode: 'result = 10 + 5\nprint(result)',
        expected: true
    },
    {
        name: "Math calculation - different variable name (should pass)",
        studentCode: 'answer = 10 + 5\nprint(answer)',
        solutionCode: 'result = 10 + 5\nprint(result)',
        expected: true
    },
    {
        name: "Math calculation - different logic (should fail)",
        studentCode: 'result = 10 * 5\nprint(result)',
        solutionCode: 'result = 10 + 5\nprint(result)',
        expected: false
    },
    {
        name: "Multiple print statements - same output (should pass)",
        studentCode: 'print("First line")\nprint("Second line")',
        solutionCode: 'print("First line")\nprint("Second line")',
        expected: true
    },
    {
        name: "Multiple print statements - different order (should fail)",
        studentCode: 'print("Second line")\nprint("First line")',
        solutionCode: 'print("First line")\nprint("Second line")',
        expected: false
    },
    {
        name: "Conditional logic - same condition (should pass)",
        studentCode: 'x = 5\nif x > 3:\n    print("Greater than 3")\nelse:\n    print("Less than or equal to 3")',
        solutionCode: 'x = 5\nif x > 3:\n    print("Greater than 3")\nelse:\n    print("Less than or equal to 3")',
        expected: true
    },
    {
        name: "Conditional logic - different condition (should fail)",
        studentCode: 'x = 5\nif x > 10:\n    print("Greater than 10")\nelse:\n    print("Less than or equal to 10")',
        solutionCode: 'x = 5\nif x > 3:\n    print("Greater than 3")\nelse:\n    print("Less than or equal to 3")',
        expected: false
    },
    {
        name: "Loop - same iteration count (should pass)",
        studentCode: 'for i in range(3):\n    print(f"Number {i}")',
        solutionCode: 'for i in range(3):\n    print(f"Number {i}")',
        expected: true
    },
    {
        name: "Loop - different iteration count (should fail)",
        studentCode: 'for i in range(2):\n    print(f"Number {i}")',
        solutionCode: 'for i in range(3):\n    print(f"Number {i}")',
        expected: false
    },
    {
        name: "Function definition - same function (should pass)",
        studentCode: 'def greet(name):\n    return f"Hello, {name}!"\nprint(greet("Alice"))',
        solutionCode: 'def greet(name):\n    return f"Hello, {name}!"\nprint(greet("Alice"))',
        expected: true
    },
    {
        name: "Function definition - different function name (should pass)",
        studentCode: 'def say_hello(name):\n    return f"Hello, {name}!"\nprint(say_hello("Alice"))',
        solutionCode: 'def greet(name):\n    return f"Hello, {name}!"\nprint(greet("Alice"))',
        expected: true
    },
    {
        name: "Function definition - different logic (should fail)",
        studentCode: 'def greet(name):\n    return f"Hi, {name}!"\nprint(greet("Alice"))',
        solutionCode: 'def greet(name):\n    return f"Hello, {name}!"\nprint(greet("Alice"))',
        expected: false
    },
    {
        name: "List operations - same result (should pass)",
        studentCode: 'numbers = [1, 2, 3]\nnumbers.append(4)\nprint(numbers)',
        solutionCode: 'numbers = [1, 2, 3]\nnumbers.append(4)\nprint(numbers)',
        expected: true
    },
    {
        name: "List operations - different result (should fail)",
        studentCode: 'numbers = [1, 2, 3]\nprint(numbers)',
        solutionCode: 'numbers = [1, 2, 3]\nnumbers.append(4)\nprint(numbers)',
        expected: false
    },
    {
        name: "Error handling - both fail (should pass)",
        studentCode: 'print(undefined_variable)',
        solutionCode: 'print(undefined_variable)',
        expected: true
    },
    {
        name: "Error handling - student fails, solution works (should fail)",
        studentCode: 'print(undefined_variable)',
        solutionCode: 'print("Hello, World!")',
        expected: false
    },
    {
        name: "Error handling - student works, solution fails (should fail)",
        studentCode: 'print("Hello, World!")',
        solutionCode: 'print(undefined_variable)',
        expected: false
    }
];

// Run tests
async function runTests() {
    console.log("Testing solution_code validation with actual Pyodide...\n");

    // Initialize Pyodide
    await initializePyodide();

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`Test ${i + 1}: ${testCase.name}`);
        
        try {
            // Create a mock rule and problem for the test
            const rule = {
                solutionCode: testCase.solutionCode
            };
            
            const problem = {
                id: `test-${i + 1}`,
                inputs: [] // No inputs for these tests
            };
            
            // Test the validation
            const result = await validateSolutionCode(
                testCase.studentCode, 
                '', // studentOutput not used in solution_code validation
                rule, 
                problem, 
                0, 
                pyodideInstance
            );
            
            if (result === testCase.expected) {
                console.log(`✅ PASSED - Expected: ${testCase.expected}, Got: ${result}`);
                passed++;
            } else {
                console.log(`❌ FAILED - Expected: ${testCase.expected}, Got: ${result}`);
                failed++;
            }
            
            console.log(`   Student Code: ${testCase.studentCode.replace(/\n/g, '\\n')}`);
            console.log(`   Solution Code: ${testCase.solutionCode.replace(/\n/g, '\\n')}`);
            console.log("");
            
        } catch (error) {
            console.log(`❌ ERROR - ${error.message}`);
            console.log(`   Student Code: ${testCase.studentCode.replace(/\n/g, '\\n')}`);
            console.log(`   Solution Code: ${testCase.solutionCode.replace(/\n/g, '\\n')}`);
            console.log("");
            failed++;
        }
    }

    console.log(`\nTest Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log("🎉 All solution_code validation tests passed!");
    } else {
        console.log("⚠️  Some tests failed. Please check the validation logic.");
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
});
