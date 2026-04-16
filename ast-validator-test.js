// Tests for the AST-based validation system
// Runs with Pyodide in Node.js, same as validation-test.js

const { parseStudentAST, validateASTRule } = require('./ast-validator.js');
const { validateAnswer } = require('./validation.js');
const { CodeExecutor } = require('./code-executor.js');

let codeExecutor = null;

async function initializePyodide() {
    console.log('Initializing CodeExecutor for AST tests...');
    codeExecutor = new CodeExecutor();
    await codeExecutor.initialize();
    console.log('CodeExecutor initialized.\n');
}

// ─── Unit tests: parseStudentAST → validateASTRule ──────────────────────────

const unitTests = [
    // ast_has_for_loop
    {
        name: 'ast_has_for_loop: detects for loop',
        code: 'for i in range(5):\n  print(i)',
        rule: { type: 'ast_has_for_loop' },
        expected: true
    },
    {
        name: 'ast_has_for_loop: fails when no for loop',
        code: 'x = 5\nprint(x)',
        rule: { type: 'ast_has_for_loop' },
        expected: false
    },

    // ast_has_if
    {
        name: 'ast_has_if: detects if statement',
        code: 'x = 5\nif x > 3:\n  print("yes")',
        rule: { type: 'ast_has_if' },
        expected: true
    },
    {
        name: 'ast_has_if: fails when no if',
        code: 'print("hello")',
        rule: { type: 'ast_has_if' },
        expected: false
    },
    {
        name: 'ast_has_if inside for: detects nested if',
        code: 'for x in [1,2,3]:\n  if x > 1:\n    print(x)',
        rule: { type: 'ast_has_if', inside: 'for' },
        expected: true
    },
    {
        name: 'ast_has_if inside for: fails when if is outside for',
        code: 'if True:\n  print("yes")\nfor x in [1,2,3]:\n  print(x)',
        rule: { type: 'ast_has_if', inside: 'for' },
        expected: false
    },

    // ast_has_method_call
    {
        name: 'ast_has_method_call: detects .append()',
        code: 'nums = []\nnums.append(1)',
        rule: { type: 'ast_has_method_call', method: 'append' },
        expected: true
    },
    {
        name: 'ast_has_method_call: fails when method not called',
        code: 'nums = [1, 2, 3]\nprint(nums)',
        rule: { type: 'ast_has_method_call', method: 'append' },
        expected: false
    },
    {
        name: 'ast_has_method_call: "append" in string literal does NOT count',
        code: 'print("append")',
        rule: { type: 'ast_has_method_call', method: 'append' },
        expected: false
    },

    // ast_has_function_call
    {
        name: 'ast_has_function_call: detects len()',
        code: 'print(len([1,2,3]))',
        rule: { type: 'ast_has_function_call', function: 'len' },
        expected: true
    },
    {
        name: 'ast_has_function_call: detects range(len(...))',
        code: 'for i in range(len([1,2,3])):\n  print(i)',
        rule: { type: 'ast_has_function_call', function: 'range', withArg: 'len' },
        expected: true
    },
    {
        name: 'ast_has_function_call: range without len fails withArg check',
        code: 'for i in range(5):\n  print(i)',
        rule: { type: 'ast_has_function_call', function: 'range', withArg: 'len' },
        expected: false
    },

    // ast_has_list_literal
    {
        name: 'ast_has_list_literal: detects list literal',
        code: 'fruits = ["apple", "banana"]\nprint(fruits)',
        rule: { type: 'ast_has_list_literal' },
        expected: true
    },
    {
        name: 'ast_has_list_literal: empty list counts',
        code: 'nums = []\nnums.append(1)',
        rule: { type: 'ast_has_list_literal' },
        expected: true
    },
    {
        name: 'ast_has_list_literal: indexing does NOT count as list literal',
        code: 'print(nums[0])',
        rule: { type: 'ast_has_list_literal' },
        expected: false
    },

    // ast_no_assign_to_method_result
    {
        name: 'ast_no_assign_to_method_result: catches x = list.append(y)',
        code: 'nums = [1,2,3]\nnums = nums.append(4)\nprint(nums)',
        rule: { type: 'ast_no_assign_to_method_result', method: 'append' },
        expected: false
    },
    {
        name: 'ast_no_assign_to_method_result: passes when append used correctly',
        code: 'nums = [1,2,3]\nnums.append(4)\nprint(nums)',
        rule: { type: 'ast_no_assign_to_method_result', method: 'append' },
        expected: true
    },
    {
        name: 'ast_no_assign_to_method_result: passes when no append at all',
        code: 'nums = [1,2,3]\nprint(nums)',
        rule: { type: 'ast_no_assign_to_method_result', method: 'append' },
        expected: true
    },

    // ast_has_for_loop with iterOver
    {
        name: 'ast_has_for_loop iterOver=range: detects range loop',
        code: 'for i in range(5):\n  print(i)',
        rule: { type: 'ast_has_for_loop', iterOver: 'range' },
        expected: true
    },
    {
        name: 'ast_has_for_loop iterOver=range: list loop fails',
        code: 'for x in [1,2,3]:\n  print(x)',
        rule: { type: 'ast_has_for_loop', iterOver: 'range' },
        expected: false
    },

    // ast_has_if with hasElse and hasElif
    {
        name: 'ast_has_if hasElse: detects else block',
        code: 'x = 5\nif x > 3:\n  print("yes")\nelse:\n  print("no")',
        rule: { type: 'ast_has_if', hasElse: true },
        expected: true
    },
    {
        name: 'ast_has_if hasElse: no else fails',
        code: 'x = 5\nif x > 3:\n  print("yes")',
        rule: { type: 'ast_has_if', hasElse: true },
        expected: false
    },
    {
        name: 'ast_has_if hasElif: detects elif block',
        code: 'x = 5\nif x > 10:\n  print("big")\nelif x > 3:\n  print("mid")\nelse:\n  print("small")',
        rule: { type: 'ast_has_if', hasElif: true },
        expected: true
    },
    {
        name: 'ast_has_if hasElif: if/else without elif fails',
        code: 'x = 5\nif x > 3:\n  print("yes")\nelse:\n  print("no")',
        rule: { type: 'ast_has_if', hasElif: true },
        expected: false
    },

    // ast_has_method_call with inside
    {
        name: 'ast_has_method_call inside=for: detects append inside loop',
        code: 'nums = []\nfor i in range(5):\n  nums.append(i)',
        rule: { type: 'ast_has_method_call', method: 'append', inside: 'for' },
        expected: true
    },
    {
        name: 'ast_has_method_call inside=for: append outside loop fails',
        code: 'nums = []\nnums.append(1)',
        rule: { type: 'ast_has_method_call', method: 'append', inside: 'for' },
        expected: false
    },

    // ast_has_assignment
    {
        name: 'ast_has_assignment: detects regular assignment',
        code: 'x = 5\nprint(x)',
        rule: { type: 'ast_has_assignment' },
        expected: true
    },
    {
        name: 'ast_has_assignment: no assignment fails',
        code: 'print("hello")',
        rule: { type: 'ast_has_assignment' },
        expected: false
    },
    {
        name: 'ast_has_assignment augOp=+=: detects augmented assignment',
        code: 'total = 0\ntotal += 5',
        rule: { type: 'ast_has_assignment', augOp: '+=' },
        expected: true
    },
    {
        name: 'ast_has_assignment augOp=+=: regular assignment fails',
        code: 'total = 0\ntotal = total + 5',
        rule: { type: 'ast_has_assignment', augOp: '+=' },
        expected: false
    },

    // ast_has_comparison
    {
        name: 'ast_has_comparison: detects any comparison',
        code: 'if x > 5:\n  print("big")',
        rule: { type: 'ast_has_comparison' },
        expected: true
    },
    {
        name: 'ast_has_comparison op===: detects ==',
        code: 'if x == 5:\n  print("yes")',
        rule: { type: 'ast_has_comparison', op: '==' },
        expected: true
    },
    {
        name: 'ast_has_comparison op===: > does not match ==',
        code: 'if x > 5:\n  print("big")',
        rule: { type: 'ast_has_comparison', op: '==' },
        expected: false
    },
    {
        name: 'ast_has_comparison op=>=: detects >=',
        code: 'if score >= 50:\n  print("pass")',
        rule: { type: 'ast_has_comparison', op: '>=' },
        expected: true
    },
    {
        name: 'ast_has_comparison op=!=: detects !=',
        code: 'if choice != 1:\n  print("wrong")',
        rule: { type: 'ast_has_comparison', op: '!=' },
        expected: true
    },

    // ast_has_fstring
    {
        name: 'ast_has_fstring: detects f-string',
        code: 'name = "Sam"\nprint(f"Hello {name}")',
        rule: { type: 'ast_has_fstring' },
        expected: true
    },
    {
        name: 'ast_has_fstring: regular string fails',
        code: 'print("Hello World")',
        rule: { type: 'ast_has_fstring' },
        expected: false
    },
    {
        name: 'ast_has_fstring variables=[name]: detects {name}',
        code: 'name = "Sam"\nprint(f"Hello {name}")',
        rule: { type: 'ast_has_fstring', variables: ['name'] },
        expected: true
    },
    {
        name: 'ast_has_fstring variables=[age]: fails when age not in f-string',
        code: 'name = "Sam"\nprint(f"Hello {name}")',
        rule: { type: 'ast_has_fstring', variables: ['age'] },
        expected: false
    },
    {
        name: 'ast_has_fstring variables=[name, age]: detects both',
        code: 'name = "Sam"\nage = 10\nprint(f"{name} is {age}")',
        rule: { type: 'ast_has_fstring', variables: ['name', 'age'] },
        expected: true
    },
    {
        name: 'ast_has_fstring: detects variable in expression {i + 1}',
        code: 'for i in range(3):\n  print(f"{i + 1}. item")',
        rule: { type: 'ast_has_fstring', variables: ['i'] },
        expected: true
    },

    // Edge cases
    {
        name: 'SyntaxError code: AST rules pass gracefully (skip)',
        code: 'for in []:',
        rule: { type: 'ast_has_for_loop' },
        expected: true  // AST rules skip gracefully on parse error
    },
    {
        name: 'Empty code: AST rules report correctly',
        code: '',
        rule: { type: 'ast_has_for_loop' },
        expected: false
    }
];

// ─── Integration tests: full validateAnswer with AST rules ──────────────────

const integrationTests = [
    {
        name: 'WS6 "Don\'t forget the brackets": correct solution passes',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_has_list_literal', message: 'Your code needs to create a list with square brackets [].' },
                    { type: 'solution_code', solutionCode: "fruits = ['apple', 'banana', 'cherry']\nprint(fruits)" }
                ]
            }
        },
        code: "fruits = ['apple', 'banana', 'cherry']\nprint(fruits)",
        output: "['apple', 'banana', 'cherry']\n",
        expected: true
    },
    {
        name: 'WS6 "Don\'t forget the brackets": tuple (no brackets) fails AST rule',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_has_list_literal', message: 'Your code needs to create a list with square brackets [].' },
                    { type: 'solution_code', solutionCode: "fruits = ['apple', 'banana', 'cherry']\nprint(fruits)" }
                ]
            }
        },
        code: "fruits = 'apple', 'banana', 'cherry'\nprint(fruits)",
        output: "('apple', 'banana', 'cherry')\n",
        expected: false,
        expectedMessage: 'Your code needs to create a list with square brackets [].'
    },
    {
        name: 'WS6 "Append trap": buggy code (assign to append result) gets helpful message',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_no_assign_to_method_result', method: 'append' },
                    { type: 'solution_code', solutionCode: "numbers = [1, 2, 3]\nnumbers.append(4)\nprint(numbers)" }
                ]
            }
        },
        code: "numbers = [1, 2, 3]\nnumbers = numbers.append(4)\nprint(numbers)",
        output: "None\n",
        expected: false,
        expectedMessage: '.append() changes the list directly and returns None'
    },
    {
        name: 'WS6 "Append trap": fixed code passes',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_no_assign_to_method_result', method: 'append' },
                    { type: 'solution_code', solutionCode: "numbers = [1, 2, 3]\nnumbers.append(4)\nprint(numbers)" }
                ]
            }
        },
        code: "numbers = [1, 2, 3]\nnumbers.append(4)\nprint(numbers)",
        output: "[1, 2, 3, 4]\n",
        expected: true
    },
    {
        name: 'WS6 "Build a list in a loop": correct solution passes',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_has_method_call', method: 'append', message: 'Use .append() to add items to the list.' },
                    { type: 'ast_has_for_loop', message: 'Use a for loop to build the list.' },
                    { type: 'solution_code', solutionCode: "numbers = []\nfor i in range(1, 6):\n  numbers.append(i)\nprint(numbers)" }
                ]
            }
        },
        code: "numbers = []\nfor i in range(1, 6):\n  numbers.append(i)\nprint(numbers)",
        output: "[1, 2, 3, 4, 5]\n",
        expected: true
    },
    {
        name: 'WS6 "Build a list in a loop": no for loop fails',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_has_method_call', method: 'append', message: 'Use .append() to add items to the list.' },
                    { type: 'ast_has_for_loop', message: 'Use a for loop to build the list.' },
                    { type: 'solution_code', solutionCode: "numbers = []\nfor i in range(1, 6):\n  numbers.append(i)\nprint(numbers)" }
                ]
            }
        },
        code: "numbers = [1, 2, 3, 4, 5]\nprint(numbers)",
        output: "[1, 2, 3, 4, 5]\n",
        expected: false,
        expectedMessage: 'Use .append() to add items to the list.'
    },
    {
        name: 'WS6 "Filtering with if": correct solution passes',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_has_if', inside: 'for', message: 'Add an if statement inside the for loop to filter the numbers.' },
                    { type: 'solution_code', solutionCode: "numbers = [2, 8, 3, 10, 1, 7, 4]\nfor num in numbers:\n  if num > 5:\n    print(num)" }
                ]
            }
        },
        code: "numbers = [2, 8, 3, 10, 1, 7, 4]\nfor num in numbers:\n  if num > 5:\n    print(num)",
        output: "8\n10\n7\n",
        expected: true
    },
    {
        name: 'WS6 "Filtering with if": no if inside for fails',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_has_if', inside: 'for', message: 'Add an if statement inside the for loop to filter the numbers.' },
                    { type: 'solution_code', solutionCode: "numbers = [2, 8, 3, 10, 1, 7, 4]\nfor num in numbers:\n  if num > 5:\n    print(num)" }
                ]
            }
        },
        code: "numbers = [2, 8, 3, 10, 1, 7, 4]\nfor num in numbers:\n  print(num)",
        output: "2\n8\n3\n10\n1\n7\n4\n",
        expected: false,
        expectedMessage: 'Add an if statement inside the for loop'
    },
    {
        name: 'WS6 "Your own numbered list": range(len(...)) passes',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_has_function_call', function: 'range', withArg: 'len', message: 'Use range(len(...)) to loop through the list with index numbers.' },
                    { type: 'output_line_count', minLines: 4 },
                    { type: 'no_errors' }
                ]
            }
        },
        code: 'games = ["Minecraft", "Roblox", "Fortnite", "Zelda"]\nfor i in range(len(games)):\n  print(f"{i + 1}. {games[i]}")',
        output: "1. Minecraft\n2. Roblox\n3. Fortnite\n4. Zelda\n",
        expected: true
    },
    {
        name: 'WS6 "Your own numbered list": simple for-in loop (no range/len) fails',
        problem: {
            validation: {
                rules: [
                    { type: 'ast_has_function_call', function: 'range', withArg: 'len', message: 'Use range(len(...)) to loop through the list with index numbers.' },
                    { type: 'output_line_count', minLines: 4 },
                    { type: 'no_errors' }
                ]
            }
        },
        code: 'games = ["Minecraft", "Roblox", "Fortnite", "Zelda"]\nfor g in games:\n  print(g)',
        output: "Minecraft\nRoblox\nFortnite\nZelda\n",
        expected: false,
        expectedMessage: 'Use range(len(...)) to loop through the list'
    }
];

// ─── Test runner ─────────────────────────────────────────────────────────────

async function runUnitTests() {
    console.log('=== AST Validator Unit Tests ===\n');
    let passed = 0, failed = 0;
    const pyodide = codeExecutor.getPyodide();

    for (const t of unitTests) {
        const astData = await parseStudentAST(t.code, pyodide);
        const result = validateASTRule(astData, t.rule);
        const ok = result.isValid === t.expected;

        if (ok) {
            console.log(`  \u2705 ${t.name}`);
            passed++;
        } else {
            console.log(`  \u274c ${t.name}`);
            console.log(`     Expected isValid=${t.expected}, got isValid=${result.isValid}`);
            if (result.message) console.log(`     Message: ${result.message}`);
            failed++;
        }
    }

    console.log(`\nUnit tests: ${passed} passed, ${failed} failed\n`);
    return failed;
}

async function runIntegrationTests() {
    console.log('=== AST Validator Integration Tests ===\n');
    let passed = 0, failed = 0;

    for (const t of integrationTests) {
        const result = await validateAnswer(t.code, t.output, t.problem, 0, codeExecutor);
        const validationOk = result.isValid === t.expected;
        let messageOk = true;
        if (t.expectedMessage && !result.isValid) {
            messageOk = result.message.includes(t.expectedMessage);
        }

        if (validationOk && messageOk) {
            console.log(`  \u2705 ${t.name}`);
            passed++;
        } else {
            console.log(`  \u274c ${t.name}`);
            if (!validationOk) {
                console.log(`     Expected isValid=${t.expected}, got isValid=${result.isValid}`);
            }
            if (!messageOk) {
                console.log(`     Expected message containing: "${t.expectedMessage}"`);
                console.log(`     Got: "${result.message}"`);
            }
            failed++;
        }
    }

    console.log(`\nIntegration tests: ${passed} passed, ${failed} failed\n`);
    return failed;
}

async function main() {
    await initializePyodide();
    const unitFailures = await runUnitTests();
    const integrationFailures = await runIntegrationTests();
    const total = unitFailures + integrationFailures;

    if (total === 0) {
        console.log('\ud83c\udf89 All AST validator tests passed!');
    } else {
        console.log(`\u26a0\ufe0f  ${total} test(s) failed.`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
