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

// Test cases for solution_code validation (legacy approach)
const legacyTestCases = [
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

// Test cases for the new seed-based validation system
const seedBasedTestCases = [
    {
        id: "seed-based-get-choice-simple",
        name: "Simple get_choice validation - correct solution",
        studentCode: `choice = get_choice(2)
if choice == 1:
    print("You chose the Wizard!")
else:
    print("You chose the Warrior!")`,
        solutionCode: `choice = get_choice(2)
if choice == 1:
    print("You chose the Wizard!")
else:
    print("You chose the Warrior!")`,
        problem: { inputs: [] },
        rule: { solutionCode: null, maxRuns: 5 },
        expectedResult: true,
        expectedMessage: null
    },
    {
        id: "seed-based-get-choice-wrong-output",
        name: "Simple get_choice validation - wrong output",
        studentCode: `choice = get_choice(2)
if choice == 1:
    print("Wizard chosen")
else:
    print("Warrior chosen")`,
        solutionCode: `choice = get_choice(2)
if choice == 1:
    print("You chose the Wizard!")
else:
    print("You chose the Warrior!")`,
        problem: { inputs: [] },
        rule: { solutionCode: null, maxRuns: 5 },
        expectedResult: false,
        expectedMessage: "With choice 1 (from 2 options), your program output: \"Wizard chosen\" but expected output: \"You chose the Wizard!\""
    },
    {
        id: "seed-based-get-input-simple",
        name: "Simple get_input validation - correct solution",
        studentCode: `name = get_input("name")
age = get_input("age")
print(f"Hello {name}, you are {age} years old")`,
        solutionCode: `name = get_input("name")
age = get_input("age")
print(f"Hello {name}, you are {age} years old")`,
        problem: { 
            inputs: [
                { name: "name", type: "string", value: "Alice" },
                { name: "age", type: "number", value: 25 }
            ]
        },
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: true,
        expectedMessage: null
    },
    {
        id: "seed-based-get-input-wrong-logic",
        name: "Simple get_input validation - wrong logic",
        studentCode: `name = get_input("name")
age = get_input("age")
print(f"Hi {name}, you are {age + 10} years old")`,
        solutionCode: `name = get_input("name")
age = get_input("age")
print(f"Hello {name}, you are {age} years old")`,
        problem: { 
            inputs: [
                { name: "name", type: "string", value: "Alice" },
                { name: "age", type: "number", value: 25 }
            ]
        },
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: false,
        expectedMessage: "With input name = \"hello\", age = undefined, your program output: \"\" but expected output: \"Hello hello, you are None years old\""
    },
    {
        id: "seed-based-complex-scenario",
        name: "Complex scenario with both get_choice and get_input",
        studentCode: `name = get_input("name")
choice = get_choice(3)
if choice == 1:
    print(f"Hello {name}, you chose option 1")
elif choice == 2:
    print(f"Hi {name}, you chose option 2")
else:
    print(f"Hey {name}, you chose option 3")`,
        solutionCode: `name = get_input("name")
choice = get_choice(3)
if choice == 1:
    print(f"Hello {name}, you chose option 1")
elif choice == 2:
    print(f"Hi {name}, you chose option 2")
else:
    print(f"Hey {name}, you chose option 3")`,
        problem: { 
            inputs: [
                { name: "name", type: "string", value: "Bob" }
            ]
        },
        rule: { solutionCode: null, maxRuns: 4 },
        expectedResult: true,
        expectedMessage: null
    },
    {
        id: "worksheet-4-problem-2",
        name: "Worksheet 4 Problem 2 - Height Rule <",
        studentCode: `height = 160

if height > 150:
  print("You can go on the big ride!")`,
        solutionCode: `height = 160

if height < 150:
  print("You can go on the smaller ride!")`,
        problem: { inputs: [] },
        rule: { solutionCode: null, maxRuns: 5 },
        expectedResult: false,
        expectedMessage: "Your program output: \"You can go on the big ride!\" but expected output: \"\""
    },
    {
        id: "multiple-failures-details-test",
        name: "Multiple failures - validate details array",
        studentCode: `choice = get_choice(2)
if choice == 1:
    print("Wrong output for choice 1")
else:
    print("Wrong output for choice 2")`,
        solutionCode: `choice = get_choice(2)
if choice == 1:
    print("Correct output for choice 1")
else:
    print("Correct output for choice 2")`,
        problem: { inputs: [] },
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: false,
        expectedMessage: "With choice 1 (from 2 options), your program output: \"Wrong output for choice 1\" but expected output: \"Correct output for choice 1\"",
        validateDetails: true,
        expectedDetailsCount: 3
    },
    {
        id: "get-input-no-args",
        name: "get_input() with no arguments - should handle undefined inputs",
        studentCode: `height = get_input()

if height > 150:
  print("You can go on the big ride!")`,
        solutionCode: `height = get_input()

if height > 150:
  print("You can go on the big ride!")`,
        problem: { inputs: [] }, // Empty inputs array
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: true,
        expectedMessage: null
    },
    {
        id: "get-input-no-args-undefined-problem",
        name: "get_input() with no arguments - problem.inputs is undefined",
        studentCode: `height = get_input()

if height > 150:
  print("You can go on the big ride!")`,
        solutionCode: `height = get_input()

if height > 150:
  print("You can go on the big ride!")`,
        problem: {}, // No inputs property at all
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: true,
        expectedMessage: null
    },
    {
        id: "get-input-no-args-null-problem",
        name: "get_input() with no arguments - problem.inputs is null",
        studentCode: `height = get_input()

if height > 150:
  print("You can go on the big ride!")`,
        solutionCode: `height = get_input()

if height > 150:
  print("You can go on the big ride!")`,
        problem: { inputs: null }, // inputs is null
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: true,
        expectedMessage: null
    },
    {
        id: "ws4-q3-rollercoaster-entry",
        name: "WS4 Q3 - Rollercoaster Entry (real scenario)",
        studentCode: `height = get_input()

if height > 140:
  print("You can ride!")`,
        solutionCode: `height = get_input()

if height > 140:
  print("You can ride!")`,
        problem: { 
            inputs: [{ "name": "height", "label": "Enter your height:", "type": "number" }]
        },
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: true,
        expectedMessage: null
    },
    {
        id: "get-input-undefined-value",
        name: "get_input() returns undefined - should handle gracefully",
        studentCode: `height = get_input()

if height > 150:
  print("You can go on the big ride!")`,
        solutionCode: `height = get_input()

if height > 150:
  print("You can go on the big ride!")`,
        problem: { 
            inputs: [] // Empty inputs array - this should cause get_input() to return undefined
        },
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: true,
        expectedMessage: null
    },
    {
        id: "manual-test-inputs-feature",
        name: "Manual test inputs feature - should catch hardcoded values",
        studentCode: `height = 160

if height > 140:
  print("You can ride!")`,
        solutionCode: `height = get_input()

if height > 140:
  print("You can ride!")`,
        problem: { 
            inputs: [
                { name: "height", type: "number", value: 150 }
            ]
        },
        rule: { 
            solutionCode: null, 
            maxRuns: 3,
            testInputs: [
                { inputs: {"height": 130}, expectedOutput: "" },
                { inputs: {"height": 150}, expectedOutput: "You can ride!\n" }
            ]
        },
        expectedResult: false,
        expectedMessage: "With input height = 130, your program output: \"You can ride!\" but expected output: \"\""
    }
];

// Run legacy tests
async function runLegacyTests() {
    console.log("Testing legacy solution_code validation...\n");

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < legacyTestCases.length; i++) {
        const testCase = legacyTestCases[i];
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

    return { passed, failed };
}

// Run seed-based tests
async function runSeedBasedTests() {
    console.log("Testing enhanced seed-based validation system...\n");
    
    let passed = 0;
    let failed = 0;
    
    for (let i = 0; i < seedBasedTestCases.length; i++) {
        const testCase = seedBasedTestCases[i];
        console.log(`Seed Test ${i + 1}: ${testCase.name}`);
        
        try {
            // Set the solution code in the rule
            testCase.rule.solutionCode = testCase.solutionCode;
            
            const result = await validateSolutionCode(
                testCase.studentCode,
                "", // studentOutput not used in solution_code validation
                testCase.rule,
                testCase.problem,
                0, // problemIndex
                pyodideInstance
            );
            
            // Check if result matches expected
            let resultMatches = false;
            let actualMessage = null;
            let detailsValid = true;
            
            if (testCase.expectedResult === true) {
                resultMatches = result === true;
            } else {
                // For failure cases, check if we got the expected error message
                if (typeof result === 'object' && result.isValid === false) {
                    actualMessage = result.message;
                    resultMatches = testCase.expectedMessage === result.message;
                    
                    // Validate details array if requested
                    if (testCase.validateDetails && result.details) {
                        detailsValid = result.details.length === testCase.expectedDetailsCount;
                        if (!detailsValid) {
                            console.log(`   Details validation failed: expected ${testCase.expectedDetailsCount} details, got ${result.details.length}`);
                        }
                    }
                } else if (typeof result === 'string') {
                    actualMessage = result;
                    resultMatches = testCase.expectedMessage === result;
                } else {
                    resultMatches = result === false;
                }
            }
            
            if (resultMatches && detailsValid) {
                console.log(`✅ PASSED - Expected: ${testCase.expectedResult}, Got: ${result}`);
                if (testCase.validateDetails && result && result.details) {
                    console.log(`   Details array validated: ${result.details.length} items`);
                    console.log(`   Details: ${result.details.join(', ')}`);
                }
                passed++;
            } else {
                console.log(`❌ FAILED - Expected: ${testCase.expectedResult}, Got: ${result}`);
                if (testCase.expectedMessage && actualMessage) {
                    console.log(`   Expected message: ${testCase.expectedMessage}`);
                    console.log(`   Actual message:   ${actualMessage}`);
                }
                if (!detailsValid) {
                    console.log(`   Details validation failed`);
                }
                failed++;
            }
            
            console.log(`   Student Code: ${testCase.studentCode.replace(/\n/g, '\\n')}`);
            console.log(`   Solution Code: ${testCase.solutionCode.replace(/\n/g, '\\n')}`);
            console.log(`   Max Runs: ${testCase.rule.maxRuns}`);
            console.log("");
            
        } catch (error) {
            console.log(`❌ ERROR - ${error.message}`);
            failed++;
            console.log("");
        }
    }
    
    return { passed, failed };
}

// Run all tests
async function runTests() {
    console.log("Testing solution_code validation with actual Pyodide...\n");

    // Initialize Pyodide
    await initializePyodide();

    // Run legacy tests
    const legacyResults = await runLegacyTests();
    
    console.log("=" * 60);
    
    // Run seed-based tests
    const seedResults = await runSeedBasedTests();

    // Summary
    const totalPassed = legacyResults.passed + seedResults.passed;
    const totalFailed = legacyResults.failed + seedResults.failed;
    const totalTests = totalPassed + totalFailed;

    console.log(`\n📊 COMPREHENSIVE TEST RESULTS`);
    console.log(`==================================================`);
    console.log(`Legacy Tests: ${legacyResults.passed} passed, ${legacyResults.failed} failed`);
    console.log(`Seed-Based Tests: ${seedResults.passed} passed, ${seedResults.failed} failed`);
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
    console.log(`Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

    if (totalFailed === 0) {
        console.log("\n🎉 All solution_code validation tests passed!");
    } else {
        console.log("\n⚠️  Some tests failed. Please check the validation logic.");
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
});
