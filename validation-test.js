// Test script to verify the validation system works correctly
// This uses the shared validation logic from validation.js

// Import the shared validation functions
const { validateAnswer } = require('./validation.js');

// Initialize Pyodide for testing
let mockCodeExecutor = null;

async function initializePyodide() {
    if (typeof window !== 'undefined') {
        // Browser environment - Pyodide should already be loaded
        mockCodeExecutor = {
            getPyodide: () => window.pyodide,
            resetPythonEnvironment: async () => {
                // Mock reset for browser tests
                try {
                    await window.pyodide.runPythonAsync(`
                        try:
                            current_globals = list(globals().keys())
                            for var_name in current_globals:
                                if not var_name.startswith("_"):
                                    try:
                                        del globals()[var_name]
                                    except:
                                        pass
                        except:
                            pass
                    `);
                } catch (error) {
                    console.warn('Mock reset failed:', error);
                }
            }
        };
    } else {
        // Node.js environment - load real Pyodide from node_modules
        console.log('Loading Pyodide from node_modules...');
        const { loadPyodide } = require('pyodide');
        const pyodide = await loadPyodide({
            indexURL: "./node_modules/pyodide/"
        });
        mockCodeExecutor = {
            getPyodide: () => pyodide,
            resetPythonEnvironment: async () => {
                // Mock reset for Node.js tests
                try {
                    await pyodide.runPythonAsync(`
                        try:
                            current_globals = list(globals().keys())
                            for var_name in current_globals:
                                if not var_name.startswith("_"):
                                    try:
                                        del globals()[var_name]
                                    except:
                                        pass
                        except:
                            pass
                    `);
                } catch (error) {
                    console.warn('Mock reset failed:', error);
                }
            }
        };
        console.log('Pyodide loaded successfully');
    }
}

// Common problem definitions that can be reused across test cases
const problemDefinitions = {
    helloWorld: {
        id: "1.1",
        validation: {
            rules: [
                {
                    type: "code_contains",
                    pattern: "print(\"Hello, World!\")",
                    description: "Code must contain the exact print statement"
                },
                {
                    type: "output_contains",
                    pattern: "Hello, World!",
                    description: "Output must contain 'Hello, World!'"
                }
            ]
        }
    },
    myNameIs: {
        id: "1.2",
        validation: {
            rules: [
                {
                    type: "code_contains",
                    pattern: "print",
                    description: "Code must contain a print statement"
                },
                {
                    type: "code_contains",
                    pattern: "My name is",
                    description: "Code must contain 'My name is'"
                },
                {
                    type: "output_contains",
                    pattern: "My name is",
                    description: "Output must contain 'My name is'"
                },
                {
                    type: "code_min_length",
                    minLength: 20,
                    description: "Code must be substantial (not just comments)"
                }
            ]
        }
    },
    animalVariable: {
        id: "2.2",
        validation: {
            rules: [
                {
                    type: "code_contains",
                    pattern: "animal =",
                    description: "Code must create a variable called 'animal'"
                },
                {
                    type: "code_contains",
                    pattern: "print(animal)",
                    description: "Code must print the animal variable"
                },
                {
                    type: "output_not_empty",
                    description: "Output must not be empty"
                },
                {
                    type: "no_errors",
                    description: "Code must not produce errors"
                }
            ]
        }
    },
    divisionProblem: {
        id: "1.10",
        validation: {
            rules: [
                {
                    type: "code_contains",
                    pattern: "print(25 / 5)",
                    description: "Code must contain the exact print statement"
                },
                {
                    type: "output_contains",
                    pattern: "5.0",
                    description: "Output must contain '5.0'"
                }
            ]
        }
    },
    parenthesesProblem: {
        id: "1.X",
        validation: {
            rules: [
                {
                    type: "code_contains",
                    pattern: "print",
                    description: "Code must contain a print statement"
                },
                {
                    type: "output_contains",
                    pattern: "5.0",
                    description: "Output must contain '5.0'"
                },
                {
                    type: "code_contains",
                    pattern: "10",
                    description: "Code must contain the number 10"
                },
                {
                    type: "code_contains",
                    pattern: "5",
                    description: "Code must contain the number 5"
                },
                {
                    type: "code_contains",
                    pattern: "3",
                    description: "Code must contain the number 3"
                },
                {
                    type: "code_contains",
                    pattern: "+",
                    description: "Code must contain the addition operator"
                },
                {
                    type: "code_contains",
                    pattern: "/",
                    description: "Code must contain the division operator"
                },
                {
                    type: "code_contains",
                    pattern: "(",
                    description: "Code must contain an opening parenthesis"
                },
                {
                    type: "code_contains",
                    pattern: ")",
                    description: "Code must contain a closing parenthesis"
                }
            ]
        }
    },
    inputToVariable: {
        id: "2.1",
        validation: {
            rules: [
                {
                    type: "output_contains_regex",
                    pattern: "^(?!0\\n$|0\\.0\\n$).+",
                    description: "Output must contain a non-zero number"
                }
            ]
        }
    }
};

// Test cases
const testCases = [
    {
        name: "Worksheet 1.1 - Hello World",
        problem: problemDefinitions.helloWorld,
        code: 'print("Hello, World!")',
        output: 'Hello, World!\n',
        expected: true
    },
    {
        name: "Worksheet 1.2 - My name is",
        problem: problemDefinitions.myNameIs,
        code: 'print("My name is Alice")',
        output: 'My name is Alice\n',
        expected: true
    },
    {
        name: "Worksheet 2.2 - Animal variable",
        problem: problemDefinitions.animalVariable,
        code: 'animal = "dog"\nprint(animal)',
        output: 'dog\n',
        expected: true
    },
    {
        name: "Worksheet 1.1 - Wrong code (should fail)",
        problem: problemDefinitions.helloWorld,
        code: 'print("Hello, Python!")',
        output: 'Hello, Python!\n',
        expected: false
    },
    {
        name: "Worksheet 1.2 - Missing required pattern (should fail)",
        problem: problemDefinitions.myNameIs,
        code: 'print("Hello")',
        output: 'Hello\n',
        expected: false
    },
    {
        name: "Worksheet 1.3 - Wrong number (should fail)",
        problem: {
            id: "1.3",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "print(42)",
                        description: "Code must contain print(42)"
                    },
                    {
                        type: "output_contains",
                        pattern: "42",
                        description: "Output must contain '42'"
                    }
                ]
            }
        },
        code: 'print(100)',
        output: '100\n',
        expected: false
    },
    {
        name: "Worksheet 1.4 - Not enough print statements (should fail)",
        problem: {
            id: "1.4",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "print",
                        description: "Code must contain print statements"
                    },
                    {
                        type: "print_count",
                        minCount: 2,
                        description: "Must have at least 2 print statements"
                    },
                    {
                        type: "output_line_count",
                        minLines: 2,
                        description: "Output must have at least 2 lines"
                    },
                    {
                        type: "code_min_length",
                        minLength: 15,
                        description: "Code must be substantial"
                    }
                ]
            }
        },
        code: 'print("Hello")',
        output: 'Hello\n',
        expected: false
    },
    {
        name: "Worksheet 2.2 - Wrong variable name (should fail)",
        problem: problemDefinitions.animalVariable,
        code: 'pet = "dog"\nprint(pet)',
        output: 'dog\n',
        expected: false
    },
    {
        name: "Worksheet 2.3 - String instead of number (should fail)",
        problem: {
            id: "2.3",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "age =",
                        description: "Code must create a variable called 'age'"
                    },
                    {
                        type: "code_contains",
                        pattern: "print(age)",
                        description: "Code must print the age variable"
                    },
                    {
                        type: "code_contains_number",
                        pattern: "age\\s*=\\s*\\d+",
                        description: "Age must be assigned a number value"
                    },
                    {
                        type: "output_is_number",
                        description: "Output must be a number"
                    }
                ]
            }
        },
        code: 'age = "twenty"\nprint(age)',
        output: 'twenty\n',
        expected: false
    },
    {
        name: "Worksheet 3.4 - Missing int() conversion (should fail)",
        problem: {
            id: "3.4",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "input(",
                        description: "Code must contain input() function"
                    },
                    {
                        type: "code_contains",
                        pattern: "int(",
                        description: "Code must contain int() conversion"
                    },
                    {
                        type: "code_contains",
                        pattern: "+",
                        description: "Code must contain addition operation"
                    },
                    {
                        type: "output_contains",
                        pattern: "sum",
                        description: "Output must contain 'sum'"
                    },
                    {
                        type: "code_min_length",
                        minLength: 30,
                        description: "Code must be substantial"
                    }
                ]
            }
        },
        code: 'first = input("Enter first number: ")\nsecond = input("Enter second number: ")\ntotal = first + second\nprint("The sum is:", total)',
        output: 'Enter first number: 5\nEnter second number: 3\nThe sum is: 53\n',
        expected: false
    },
    {
        name: "Worksheet 3.4 - Correct solution (should pass)",
        problem: {
            id: "3.4",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "input(",
                        description: "Code must contain input() function"
                    },
                    {
                        type: "code_contains",
                        pattern: "int(",
                        description: "Code must contain int() conversion"
                    },
                    {
                        type: "code_contains",
                        pattern: "+",
                        description: "Code must contain addition operation"
                    },
                    {
                        type: "output_contains",
                        pattern: "sum",
                        description: "Output must contain 'sum'"
                    },
                    {
                        type: "code_min_length",
                        minLength: 30,
                        description: "Code must be substantial"
                    }
                ]
            }
        },
        code: 'a = int(input("Enter first number: "))\nb = int(input("Enter second number: "))\nresult = a + b\nprint("The sum is:", result)',
        output: 'Enter first number: 5\nEnter second number: 3\nThe sum is: 8\n',
        expected: true
    },
    {
        name: "Empty code (should fail)",
        problem: {
            id: "empty-test",
            validation: {
                rules: [
                    {
                        type: "code_min_length",
                        minLength: 10,
                        description: "Code must be substantial"
                    }
                ]
            }
        },
        code: '# Just a comment\n',
        output: '',
        expected: false
    },
    {
        name: "Code with errors (should fail)",
        problem: {
            id: "error-test",
            validation: {
                rules: [
                    {
                        type: "no_errors",
                        description: "Code must not produce errors"
                    }
                ]
            }
        },
        code: 'print(undefined_variable)',
        output: 'NameError: name \'undefined_variable\' is not defined\n',
        expected: false
    },
    {
        name: "Worksheet 1.10 - Division problem (should pass with 5.0)",
        problem: problemDefinitions.divisionProblem,
        code: 'print(25 / 5)',
        output: '5.0\n',
        expected: true
    },
    {
        name: "Worksheet 1.10 - Division problem (should pass with 5)",
        problem: problemDefinitions.divisionProblem,
        code: 'print(25 / 5)',
        output: '5\n',
        expected: true
    },
    {
        name: "Worksheet 1.X - Using Parentheses (user's code format)",
        problem: problemDefinitions.parenthesesProblem,
        code: 'print((10+5)/3)',
        output: '5\n',
        expected: true
    },
    {
        name: "Worksheet 1.X - Using Parentheses (with spaces)",
        problem: problemDefinitions.parenthesesProblem,
        code: 'print((10 + 5) / 3)',
        output: '5\n',
        expected: true
    },
    {
        name: "Worksheet 1.X - Using Parentheses (wrong numbers should fail)",
        problem: problemDefinitions.parenthesesProblem,
        code: 'print((5+5)/3)',
        output: '3.3333333333333335\n',
        expected: false
    },
    {
        name: "Worksheet 2.1 - Input to Variable (positive number should pass)",
        problem: problemDefinitions.inputToVariable,
        code: 'num = 42\nprint(num)',
        output: '42\n',
        expected: true
    },
    {
        name: "Worksheet 2.1 - Input to Variable (negative number should pass)",
        problem: problemDefinitions.inputToVariable,
        code: 'num = -5\nprint(num)',
        output: '-5\n',
        expected: true
    },
    {
        name: "Worksheet 2.1 - Input to Variable (decimal number should pass)",
        problem: problemDefinitions.inputToVariable,
        code: 'num = 3.14\nprint(num)',
        output: '3.14\n',
        expected: true
    },
    {
        name: "Worksheet 2.1 - Input to Variable (zero should fail)",
        problem: problemDefinitions.inputToVariable,
        code: 'num = 0\nprint(num)',
        output: '0\n',
        expected: false
    },
    {
        name: "Worksheet 2.1 - Input to Variable (zero decimal should fail)",
        problem: problemDefinitions.inputToVariable,
        code: 'num = 0.0\nprint(num)',
        output: '0.0\n',
        expected: false
    },
    {
        name: "Worksheet 2.1 - Input to Variable (string should pass)",
        problem: problemDefinitions.inputToVariable,
        code: 'num = "hello"\nprint(num)',
        output: 'hello\n',
        expected: true
    },
    {
        name: "Worksheet 2.1 - Input to Variable (empty output should fail)",
        problem: problemDefinitions.inputToVariable,
        code: 'num = 0\n# No print statement',
        output: '',
        expected: false
    },
    {
        name: "Worksheet 2.7 - Adding two inputs (zero inputs should fail)",
        problem: {
            id: "2.7",
            validation: {
                rules: [
                    {
                        type: "code_contains_regex",
                        pattern: "get_input\\('a'\\)"
                    },
                    {
                        type: "code_contains_regex",
                        pattern: "get_input\\('b'\\)"
                    },
                    {
                        type: "code_contains_regex",
                        pattern: "result = num1 \\+ num2"
                    },
                    {
                        type: "output_contains_regex",
                        pattern: "^(?!0\\n$|0\\.0\\n$).+"
                    }
                ]
            }
        },
        code: 'num1 = get_input(\'a\')\nnum2 = get_input(\'b\')\nresult = num1 + num2\nprint(result)',
        output: '0\n',
        expected: false
    },
    {
        name: "Worksheet 2.7 - Adding two inputs (non-zero inputs should pass)",
        problem: {
            id: "2.7",
            validation: {
                rules: [
                    {
                        type: "code_contains_regex",
                        pattern: "get_input\\('a'\\)"
                    },
                    {
                        type: "code_contains_regex",
                        pattern: "get_input\\('b'\\)"
                    },
                    {
                        type: "code_contains_regex",
                        pattern: "result = num1 \\+ num2"
                    },
                    {
                        type: "output_contains_regex",
                        pattern: "^(?!0\\n$|0\\.0\\n$).+"
                    }
                ]
            }
        },
        code: 'num1 = get_input(\'a\')\nnum2 = get_input(\'b\')\nresult = num1 + num2\nprint(result)',
        output: '15\n',
        expected: true
    },
    // New tests for helpful error messages
    {
        name: "Helpful Error - Missing print statement when output expected",
        problem: {
            id: "test-missing-print",
            validation: {
                rules: [
                    {
                        type: "output_contains",
                        pattern: "20"
                    }
                ]
            }
        },
        code: '(7+13)',
        output: '',
        expected: false,
        expectedErrorType: 'missing_print',
        expectedMessage: 'Your program should produce some output. Try adding a print() statement.'
    },
    {
        name: "Helpful Error - Wrong numerical output",
        problem: {
            id: "test-wrong-number",
            validation: {
                rules: [
                    {
                        type: "output_contains",
                        pattern: "15"
                    }
                ]
            }
        },
        code: 'print(30-14)',
        output: '16',
        expected: false,
        expectedErrorType: 'wrong_number',
        expectedMessage: 'Expected output: 15, but your program output: 16'
    },
    {
        name: "Helpful Error - Correct numerical output should pass",
        problem: {
            id: "test-correct-number",
            validation: {
                rules: [
                    {
                        type: "output_contains",
                        pattern: "15"
                    }
                ]
            }
        },
        code: 'print(30-15)',
        output: '15',
        expected: true
    },
    {
        name: "Helpful Error - No print suggestion when no output expected",
        problem: {
            id: "test-no-output-expected",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "print"
                    },
                    {
                        type: "output_not_empty"
                    }
                ]
            }
        },
        code: 'print("hello")',
        output: '',
        expected: false,
        expectedErrorType: 'general_error',
        expectedMessage: 'Not quite right! Check the task requirements and try again.'
    },
    {
        name: "Helpful Error - Right number but wrong operations should get generic message",
        problem: {
            id: "test-divide-problem",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "/"
                    },
                    {
                        type: "output_contains",
                        pattern: "10.0"
                    }
                ]
            }
        },
        code: 'print(100)',
        output: '100',
        expected: false,
        expectedErrorType: 'general_error',
        expectedMessage: 'Not quite right! Check the task requirements and try again.'
    },
    {
        name: "Helpful Error - Write to divide problem exact scenario",
        problem: {
            id: "write-to-divide",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "print"
                    },
                    {
                        type: "output_contains",
                        pattern: "10.0"
                    },
                    {
                        type: "code_contains",
                        pattern: "100"
                    },
                    {
                        type: "code_contains",
                        pattern: "10"
                    },
                    {
                        type: "code_contains",
                        pattern: "/"
                    }
                ]
            }
        },
        code: 'print(100)',
        output: '100',
        expected: false,
        expectedErrorType: 'general_error',
        expectedMessage: 'Not quite right! Check the task requirements and try again.'
    },
    {
        name: "Normalized numerical comparison - Multiplication with .0 pattern",
        problem: {
            id: "test-multiply-normalized",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "*"
                    },
                    {
                        type: "output_contains",
                        pattern: "50.0"
                    }
                ]
            }
        },
        code: 'print(5 * 10)',
        output: '50',
        expected: true
    },
    {
        name: "Normalized numerical comparison - Addition with .0 pattern",
        problem: {
            id: "test-add-normalized",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "+"
                    },
                    {
                        type: "output_contains",
                        pattern: "15.0"
                    }
                ]
            }
        },
        code: 'print(7 + 8)',
        output: '15',
        expected: true
    },
    {
        name: "Helpful Error - Should not show wrong number when normalized comparison matches",
        problem: {
            id: "test-normalized-helpful-error",
            validation: {
                rules: [
                    {
                        type: "code_contains",
                        pattern: "/"
                    },
                    {
                        type: "output_contains",
                        pattern: "10.0"
                    }
                ]
            }
        },
        code: 'print(100/10)',
        output: '10',
        expected: true
    },
    // Solution code validation tests
    {
        name: "Solution Code - Simple print statement (should pass)",
        problem: {
            id: "test-solution-code-simple",
            validation: {
                rules: [
                    {
                        type: "solution_code",
                        solutionCode: 'print("Hello, World!")'
                    }
                ]
            }
        },
        code: 'print("Hello, World!")',
        output: 'Hello, World!\n',
        expected: true
    },
    {
        name: "Solution Code - Different print statement (should fail)",
        problem: {
            id: "test-solution-code-different",
            validation: {
                rules: [
                    {
                        type: "solution_code",
                        solutionCode: 'print("Hello, World!")'
                    }
                ]
            }
        },
        code: 'print("Hello, Python!")',
        output: 'Hello, Python!\n',
        expected: false
    },
    {
        name: "Solution Code - Variable assignment (should pass)",
        problem: {
            id: "test-solution-code-variable",
            validation: {
                rules: [
                    {
                        type: "solution_code",
                        solutionCode: 'name = "Alice"\nprint("Hello, " + name)'
                    }
                ]
            }
        },
        code: 'name = "Alice"\nprint("Hello, " + name)',
        output: 'Hello, Alice\n',
        expected: true
    },
    {
        name: "Solution Code - Variable assignment with different variable name (should pass)",
        problem: {
            id: "test-solution-code-variable-different-name",
            validation: {
                rules: [
                    {
                        type: "solution_code",
                        solutionCode: 'name = "Alice"\nprint("Hello, " + name)'
                    }
                ]
            }
        },
        code: 'person = "Alice"\nprint("Hello, " + person)',
        output: 'Hello, Alice\n',
        expected: true
    },
    {
        name: "Solution Code - Math calculation (should pass)",
        problem: {
            id: "test-solution-code-math",
            validation: {
                rules: [
                    {
                        type: "solution_code",
                        solutionCode: 'result = 10 + 5\nprint(result)'
                    }
                ]
            }
        },
        code: 'result = 10 + 5\nprint(result)',
        output: '15\n',
        expected: true
    },
    {
        name: "Solution Code - Math calculation with different variable name (should pass)",
        problem: {
            id: "test-solution-code-math-different-name",
            validation: {
                rules: [
                    {
                        type: "solution_code",
                        solutionCode: 'result = 10 + 5\nprint(result)'
                    }
                ]
            }
        },
        code: 'answer = 10 + 5\nprint(answer)',
        output: '15\n',
        expected: true
    }
];

// Run tests
async function runTests() {
    console.log("Testing validation system...\n");

    // Initialize Pyodide
    await initializePyodide();

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`Test ${i + 1}: ${testCase.name}`);
        
        const result = await validateAnswer(testCase.code, testCase.output, testCase.problem, 0, mockCodeExecutor);
        
        // Check if the result matches expected validation outcome
        const validationPassed = result.isValid === testCase.expected;
        
        // Check error type if specified
        let errorTypePassed = true;
        if (testCase.expectedErrorType && !result.isValid) {
            errorTypePassed = result.errorType === testCase.expectedErrorType;
        }
        
        // Check for specific error messages
        let messagePassed = true;
        if (testCase.expectedMessage) {
            messagePassed = result.message.includes(testCase.expectedMessage);
        }
        
        if (validationPassed && errorTypePassed && messagePassed) {
            console.log(`✅ PASSED - Expected: ${testCase.expected}, Got: ${result.isValid}`);
            if (testCase.expectedErrorType) {
                console.log(`   Error Type: ${result.errorType}`);
            }
            passed++;
        } else {
            console.log(`❌ FAILED - Expected: ${testCase.expected}, Got: ${result.isValid}`);
            if (testCase.expectedErrorType) {
                console.log(`   Expected Error Type: ${testCase.expectedErrorType}, Got: ${result.errorType}`);
            }
            if (!messagePassed) {
                console.log(`   ❌ Message assertion failed:`);
                console.log(`      Expected: "${testCase.expectedMessage}"`);
                console.log(`      Got:      "${result.message}"`);
            }
            failed++;
        }
        
        console.log(`   Code: "${testCase.code}"`);
        console.log(`   Output: "${testCase.output}"`);
        console.log(`   Message: "${result.message}"`);
        console.log("");
    }

    console.log(`\nTest Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log("🎉 All tests passed! The validation system is working correctly.");
    } else {
        console.log("⚠️  Some tests failed. Please check the validation logic.");
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
});
