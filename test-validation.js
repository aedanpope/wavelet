// Test script to verify the validation system works correctly
// This uses the shared validation logic from validation.js

// Import the shared validation functions
const { validateAnswer } = require('./validation.js');

// Test cases
const testCases = [
    {
        name: "Worksheet 1.1 - Hello World",
        problem: {
            id: "1.1",
            validation: {
                type: "exact_match",
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
        code: 'print("Hello, World!")',
        output: 'Hello, World!\n',
        expected: true
    },
    {
        name: "Worksheet 1.2 - My name is",
        problem: {
            id: "1.2",
            validation: {
                type: "pattern_match",
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
        code: 'print("My name is Alice")',
        output: 'My name is Alice\n',
        expected: true
    },
    {
        name: "Worksheet 2.2 - Animal variable",
        problem: {
            id: "2.2",
            validation: {
                type: "pattern_match",
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
        code: 'animal = "dog"\nprint(animal)',
        output: 'dog\n',
        expected: true
    },
    {
        name: "Worksheet 1.1 - Wrong code (should fail)",
        problem: {
            id: "1.1",
            validation: {
                type: "exact_match",
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
        code: 'print("Hello, Python!")',
        output: 'Hello, Python!\n',
        expected: false
    },
    {
        name: "Worksheet 1.2 - Missing required pattern (should fail)",
        problem: {
            id: "1.2",
            validation: {
                type: "pattern_match",
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
        code: 'print("Hello")',
        output: 'Hello\n',
        expected: false
    },
    {
        name: "Worksheet 1.3 - Wrong number (should fail)",
        problem: {
            id: "1.3",
            validation: {
                type: "exact_match",
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
                type: "pattern_match",
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
        problem: {
            id: "2.2",
            validation: {
                type: "pattern_match",
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
        code: 'pet = "dog"\nprint(pet)',
        output: 'dog\n',
        expected: false
    },
    {
        name: "Worksheet 2.3 - String instead of number (should fail)",
        problem: {
            id: "2.3",
            validation: {
                type: "pattern_match",
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
                type: "pattern_match",
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
                type: "pattern_match",
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
                type: "pattern_match",
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
                type: "pattern_match",
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
        problem: {
            id: "1.10",
            validation: {
                type: "exact_match",
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
        code: 'print(25 / 5)',
        output: '5.0\n',
        expected: true
    },
    {
        name: "Worksheet 1.10 - Division problem (should pass with 5)",
        problem: {
            id: "1.10",
            validation: {
                type: "exact_match",
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
        code: 'print(25 / 5)',
        output: '5\n',
        expected: true
    }
];

// Run tests
console.log("Testing validation system...\n");

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    
    const result = validateAnswer(testCase.code, testCase.output, testCase.problem);
    
    if (result === testCase.expected) {
        console.log(`✅ PASSED - Expected: ${testCase.expected}, Got: ${result}`);
        passed++;
    } else {
        console.log(`❌ FAILED - Expected: ${testCase.expected}, Got: ${result}`);
        failed++;
    }
    
    console.log(`   Code: "${testCase.code}"`);
    console.log(`   Output: "${testCase.output}"`);
    console.log("");
});

console.log(`\nTest Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
    console.log("🎉 All tests passed! The validation system is working correctly.");
} else {
    console.log("⚠️  Some tests failed. Please check the validation logic.");
}
