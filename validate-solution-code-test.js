// Test script for solution_code validation using actual Pyodide
// This tests the Python/JavaScript boundary and more advanced validation scenarios

// Import the solution code validator directly
const { validateSolutionCode } = require('./validate-solution-code.js');

// Import the real CodeExecutor
const { CodeExecutor } = require('./code-executor.js');

// Initialize CodeExecutor for testing
let codeExecutor = null;

async function initializePyodide() {
    console.log('Initializing CodeExecutor...');
    codeExecutor = new CodeExecutor();
    await codeExecutor.initialize();
    console.log('CodeExecutor initialized successfully');
}

const testCases = [
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
        expectedMessage: "With choice 1 (from 2 options), your program output:\nWizard chosen\nbut expected output:\nYou chose the Wizard!"
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
        expectedMessage: "With input name = \"hello\", age = 3, your program output:\nHi hello, you are 13 years old\nbut expected output:\nHello hello, you are 3 years old"
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
        expectedMessage: "Output does not match the expected output:\n"
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
        expectedMessage: "With choice 1 (from 2 options), your program output:\nWrong output for choice 1\nbut expected output:\nCorrect output for choice 1",
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
        expectedMessage: "With input height = 130, your program output:\nYou can ride!\nbut expected output:\n"
    },
    {
        id: "missing-input-test",
        name: "Student code missing input - should show all solution inputs",
        studentCode: `x = get_input('x')
y = get_input('y')
result = x + y
print(result)`,
        solutionCode: `x = get_input('x')
y = get_input('y')
z = get_input('z')
result = x + y + z
print(result)`,
        problem: { 
            inputs: [
                { name: "x", type: "number", value: 2 },
                { name: "y", type: "number", value: 3 },
                { name: "z", type: "number", value: 5 }
            ]
        },
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: false,
        expectedMessage: "With input x = 2, y = 3, z = 5, your program output:\n5\nbut expected output:\n10"
    },
    {
        id: "debugging-print-statements",
        name: "Student code with debugging print statements - should pass validation",
        studentCode: `print("Debug: Starting calculation")
x = get_input('x')
print(f"Debug: Got x = {x}")
y = get_input('y')
print(f"Debug: Got y = {y}")
result = x + y
print(f"Debug: Calculated result = {result}")
print(f"Final result: {result}")`,
        solutionCode: `x = get_input('x')
y = get_input('y')
result = x + y
print(f"Final result: {result}")`,
        problem: { 
            inputs: [
                { name: "x", type: "number", value: 5 },
                { name: "y", type: "number", value: 7 }
            ]
        },
        rule: { solutionCode: null, maxRuns: 3 },
        expectedResult: true,
        expectedMessage: null
    },
    // Test cases from TODO.md - Problem 15: Secret Password validation fix
    {
        id: "todo-secret-password-wrong-numbers",
        name: "TODO.md Test Case 1 - Wrong numbers (should fail)",
        studentCode: `num = get_input('num')
code = get_input('code')

if num >= 12 and code == 43:
  print("Welcome to the movie")
else:
  print('access denied')`,
        solutionCode: `num = get_input('num')
code = get_input('code')
if num == 7 and code == 123:
  print('Access granted')
else:
  print('Access denied')`,
        problem: { 
            inputs: [
                { name: "num", type: "number", value: 7 },
                { name: "code", type: "number", value: 123 }
            ]
        },
        rule: { 
            solutionCode: null, 
            maxRuns: 3,
            testInputs: [
                {"inputs": {"num": 7, "code": 123}, "expectedOutput": "Access granted"},
                {"inputs": {"num": 5, "code": 123}, "expectedOutput": "Access denied"},
                {"inputs": {"num": 7, "code": 456}, "expectedOutput": "Access denied"},
                {"inputs": {"num": 12, "code": 43}, "expectedOutput": "Access denied"}
            ]
        },
        expectedResult: false,
        expectedMessage: "With input num = 7, code = 123, your program output:\naccess denied\nbut expected output:\nAccess granted"
    },
    {
        id: "todo-secret-password-no-logic",
        name: "TODO.md Test Case 2 - No conditional logic (should fail)",
        studentCode: `num = get_input('num')
code = get_input('code')

print('Access denied')`,
        solutionCode: `num = get_input('num')
code = get_input('code')
if num == 7 and code == 123:
  print('Access granted')
else:
  print('Access denied')`,
        problem: { 
            inputs: [
                { name: "num", type: "number", value: 7 },
                { name: "code", type: "number", value: 123 }
            ]
        },
        rule: { 
            solutionCode: null, 
            maxRuns: 3,
            testInputs: [
                {"inputs": {"num": 7, "code": 123}, "expectedOutput": "Access granted"},
                {"inputs": {"num": 5, "code": 123}, "expectedOutput": "Access denied"},
                {"inputs": {"num": 7, "code": 456}, "expectedOutput": "Access denied"},
                {"inputs": {"num": 12, "code": 43}, "expectedOutput": "Access denied"}
            ]
        },
        expectedResult: false,
        expectedMessage: "With input num = 7, code = 123, your program output:\nAccess denied\nbut expected output:\nAccess granted"
    },
    {
        id: "todo-secret-password-correct",
        name: "TODO.md Test Case 3 - Correct solution (should pass)",
        studentCode: `num = get_input('num')
code = get_input('code')
if num == 7 and code == 123:
  print('Access granted')
else:
  print('Access denied')`,
        solutionCode: `num = get_input('num')
code = get_input('code')
if num == 7 and code == 123:
  print('Access granted')
else:
  print('Access denied')`,
        problem: { 
            inputs: [
                { name: "num", type: "number", value: 7 },
                { name: "code", type: "number", value: 123 }
            ]
        },
        rule: { 
            solutionCode: null, 
            maxRuns: 3,
            testInputs: [
                {"inputs": {"num": 7, "code": 123}, "expectedOutput": "Access granted"},
                {"inputs": {"num": 5, "code": 123}, "expectedOutput": "Access denied"},
                {"inputs": {"num": 7, "code": 456}, "expectedOutput": "Access denied"},
                {"inputs": {"num": 12, "code": 43}, "expectedOutput": "Access denied"}
            ]
        },
        expectedResult: true,
        expectedMessage: null
    }
];

async function runTestCases() {
    console.log("Testing enhanced seed-based validation system...\n");
    
    let passed = 0;
    let failed = 0;
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
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
                codeExecutor
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

    const results = await runTestCases();

    // Summary
    const totalPassed = results.passed;
    const totalFailed = results.failed;
    const totalTests = totalPassed + totalFailed;

    console.log(`\n📊 COMPREHENSIVE TEST RESULTS`);
    console.log(`==================================================`);
    console.log(`Tests: ${results.passed} passed, ${results.failed} failed`);
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
