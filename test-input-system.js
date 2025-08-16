// Test file for the input system functionality
// This tests the new input system for Worksheet 2

// Import the shared input system module
const InputSystem = require('./input-system.js');

// Mock the DOM environment for Node.js testing
global.document = {
    getElementById: function(id) {
        return mockInputElements[id] || null;
    }
};

// Mock the DOM elements and Pyodide environment for testing
const mockPyodide = {
    globals: {
        set: function(name, value) {
            this[name] = value;
        },
        get: function(name) {
            return this[name];
        }
    }
};

// Mock DOM elements
const mockInputElements = {
    'input-2-first_number': { value: '5' },
    'input-2-second_number': { value: '3' },
    'input-3-celsius': { value: '25' },
    'input-4-number1': { value: '10' },
    'input-4-number2': { value: '5' },
    'input-4-operation': { value: '+' }
};

// Test the get_input() function logic
function testGetInputFunction() {
    console.log('Testing get_input() function...');
    
    // Test case 1: Simple number inputs
    const problem1 = {
        inputs: [
            { name: 'first_number', type: 'number', label: 'First number:' },
            { name: 'second_number', type: 'number', label: 'Second number:' }
        ]
    };
    
    // Use the real shared input system code
    const mockGetInput = InputSystem.createGetInputFunction(problem1, 2);
    
    // Test the function with arguments
    const result1 = mockGetInput('first_number');
    const result2 = mockGetInput('second_number');
    
    // Test the function without arguments (should return first input)
    const result3 = mockGetInput();
    const result4 = mockGetInput(null);
    
    console.log('get_input("first_number"):', result1);
    console.log('get_input("second_number"):', result2);
    console.log('get_input() [no args]:', result3);
    console.log('get_input(null):', result4);
    
    // Verify that no-argument calls return the first input
    if (result3 === result1 && result4 === result1) {
        console.log('✅ No-argument get_input() correctly returns first input');
    } else {
        console.log('❌ No-argument get_input() not working correctly');
    }
    
    return true;
}

// Test single input functionality
function testSingleInputFunction() {
    console.log('Testing single input get_input() functionality...');
    
    // Test case: Single input problem
    const singleInputProblem = {
        inputs: [
            { name: 'temperature', type: 'number', label: 'Temperature:' }
        ]
    };
    
    // Mock DOM element for single input
    const originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
        if (id === 'input-3-temperature') {
            return { value: '25' };
        }
        return originalGetElementById ? originalGetElementById(id) : null;
    };
    
    // Use the real shared input system code
    const mockGetInputSingle = InputSystem.createGetInputFunction(singleInputProblem, 3);
    
    // Test single input with and without arguments
    const resultWithArg = mockGetInputSingle('temperature');
    const resultWithoutArg = mockGetInputSingle();
    
    console.log('get_input("temperature"):', resultWithArg);
    console.log('get_input() [single input]:', resultWithoutArg);
    
    // Verify both return the same value
    if (resultWithArg === resultWithoutArg && resultWithArg === 25) {
        console.log('✅ Single input get_input() works correctly with and without arguments');
    } else {
        console.log('❌ Single input get_input() not working correctly');
    }
    
    // Restore original getElementById
    document.getElementById = originalGetElementById;
    
    return true;
}

// Test the setupGetInputFunction
function testSetupGetInputFunction() {
    console.log('Testing setupGetInputFunction...');
    
    const testProblem = {
        inputs: [
            { name: 'test_input', type: 'number' }
        ]
    };
    
    // Mock Pyodide globals
    const mockGlobals = {};
    const mockPyodide = {
        globals: {
            set: function(name, value) {
                mockGlobals[name] = value;
            },
            get: function(name) {
                return mockGlobals[name];
            }
        }
    };
    
    // Test setupGetInputFunction
    InputSystem.setupGetInputFunction(mockPyodide, testProblem, 4);
    
    // Verify that get_input function was set
    if (mockGlobals.get_input && typeof mockGlobals.get_input === 'function') {
        console.log('✅ setupGetInputFunction correctly sets get_input in Pyodide globals');
        
        // Test that the function works - now it should throw an error when input element not found
        try {
            const testResult = mockGlobals.get_input();
            console.log('❌ setupGetInputFunction should have thrown an error for missing input element');
        } catch (error) {
            if (error.message.includes('Input field \'test_input\' not found')) {
                console.log('✅ setupGetInputFunction creates working get_input function with proper error handling');
            } else {
                console.log('❌ setupGetInputFunction creates get_input function with unexpected error:', error.message);
            }
        }
    } else {
        console.log('❌ setupGetInputFunction failed to set get_input in Pyodide globals');
    }
    
    return true;
}

// Test the worksheet structure with mock data
function testWorksheetStructure() {
    console.log('Testing worksheet structure...');
    
    // Mock worksheet data instead of loading from file
    const mockWorksheet = {
        id: "worksheet-2",
        title: "Worksheet 2: Storing Your Numbers",
        description: "Learn to use variables to store and manipulate data in Python.",
        problems: [
            {
                title: "Simple Variable Assignment",
                inputs: null // No inputs
            },
            {
                title: "Using Variables in Calculations", 
                inputs: null // No inputs
            },
            {
                title: "Interactive Addition with Input",
                inputs: [
                    { name: 'first_number', type: 'number', label: 'First number:' },
                    { name: 'second_number', type: 'number', label: 'Second number:' }
                ]
            },
            {
                title: "Temperature Converter",
                inputs: [
                    { name: 'celsius', type: 'number', label: 'Temperature in Celsius:' }
                ]
            },
            {
                title: "Simple Calculator",
                inputs: [
                    { name: 'number1', type: 'number', label: 'First number:' },
                    { name: 'number2', type: 'number', label: 'Second number:' },
                    { name: 'operation', type: 'text', label: 'Operation (+, -, *, /):' }
                ]
            }
        ]
    };
    
    console.log('Worksheet loaded successfully:', mockWorksheet.title);
    
    // Check that problems have the expected structure
    mockWorksheet.problems.forEach((problem, index) => {
        console.log(`Problem ${index + 1}: ${problem.title}`);
        
        if (problem.inputs) {
            console.log(`  - Has ${problem.inputs.length} input(s)`);
            problem.inputs.forEach(input => {
                console.log(`    * ${input.name}: ${input.type} - ${input.label}`);
            });
        } else {
            console.log('  - No inputs required');
        }
    });
}

// Test input validation
function testInputValidation() {
    console.log('Testing input validation...');
    
    const testCases = [
        { value: '5', type: 'number', expected: 5, shouldPass: true },
        { value: '3.14', type: 'number', expected: 3.14, shouldPass: true },
        { value: 'abc', type: 'number', expected: NaN, shouldPass: false },
        { value: '', type: 'number', expected: NaN, shouldPass: false },
        { value: 'hello', type: 'text', expected: 'hello', shouldPass: true },
        { value: '123', type: 'text', expected: '123', shouldPass: true }
    ];
    
    testCases.forEach((testCase, index) => {
        let value = testCase.value;
        
        if (testCase.type === 'number') {
            value = parseFloat(value);
            const isValid = !isNaN(value);
            
            if (isValid === testCase.shouldPass) {
                console.log(`✓ Test ${index + 1} passed: "${testCase.value}" -> ${value}`);
            } else {
                console.log(`✗ Test ${index + 1} failed: "${testCase.value}" -> ${value}`);
            }
        } else {
            console.log(`✓ Test ${index + 1} passed: "${testCase.value}" -> ${value}`);
        }
    });
}

// Test error handling for invalid input names
function testErrorHandling() {
    console.log('Testing error handling for invalid input names...');
    
    const problem = {
        inputs: [
            { name: 'first_number', type: 'number', label: 'First number:' },
            { name: 'second_number', type: 'number', label: 'Second number:' }
        ]
    };
    
    const mockGetInput = InputSystem.createGetInputFunction(problem, 2);
    
    // Test case 1: Invalid input name
    try {
        mockGetInput('invalid_name');
        console.log('✗ Test failed: Should have thrown an error for invalid input name');
    } catch (error) {
        if (error.message.includes('Input field \'invalid_name\' not found')) {
            console.log('✓ Test passed: Correct error message for invalid input name');
        } else {
            console.log('✗ Test failed: Unexpected error message:', error.message);
        }
    }
    
    // Test case 2: Problem with no inputs
    const problemNoInputs = { inputs: [] };
    const mockGetInputNoInputs = InputSystem.createGetInputFunction(problemNoInputs, 3);
    
    try {
        mockGetInputNoInputs();
        console.log('✗ Test failed: Should have thrown an error for problem with no inputs');
    } catch (error) {
        if (error.message.includes('No input fields are available')) {
            console.log('✓ Test passed: Correct error message for problem with no inputs');
        } else {
            console.log('✗ Test failed: Unexpected error message:', error.message);
        }
    }
    
    // Test case 3: Problem with no inputs property
    const problemNoInputsProperty = {};
    const mockGetInputNoInputsProperty = InputSystem.createGetInputFunction(problemNoInputsProperty, 4);
    
    try {
        mockGetInputNoInputsProperty();
        console.log('✗ Test failed: Should have thrown an error for problem with no inputs property');
    } catch (error) {
        if (error.message.includes('No input fields are available')) {
            console.log('✓ Test passed: Correct error message for problem with no inputs property');
        } else {
            console.log('✗ Test failed: Unexpected error message:', error.message);
        }
    }
}

// Test HTML generation
function testHTMLGeneration() {
    console.log('Testing HTML generation...');
    
    const mockProblem = {
        inputs: [
            { name: 'first_number', type: 'number', label: 'First number:', placeholder: 'Enter a number' },
            { name: 'second_number', type: 'number', label: 'Second number:', placeholder: 'Enter another number' }
        ]
    };
    
    // Simulate the HTML generation logic from createProblemElement
    const inputsHTML = mockProblem.inputs.map(input => `
        <div class="input-field">
            <label for="input-2-${input.name}">${input.label}</label>
            <input 
                type="${input.type}" 
                id="input-2-${input.name}" 
                name="${input.name}"
                placeholder="${input.placeholder || ''}"
                class="problem-input"
            >
        </div>
    `).join('');
    
    console.log('Generated HTML structure:');
    console.log(inputsHTML);
    
    // Verify the HTML contains expected elements
    const hasInputFields = inputsHTML.includes('input-field');
    const hasLabels = inputsHTML.includes('label');
    const hasInputs = inputsHTML.includes('input');
    const hasCorrectIds = inputsHTML.includes('input-2-first_number') && inputsHTML.includes('input-2-second_number');
    
    if (hasInputFields && hasLabels && hasInputs && hasCorrectIds) {
        console.log('✓ HTML generation test passed');
    } else {
        console.log('✗ HTML generation test failed');
    }
}

// Run all tests
console.log('Starting input system tests...');
console.log('=====================================');

testGetInputFunction();
console.log('-------------------------------------');

testSingleInputFunction();
console.log('-------------------------------------');

testSetupGetInputFunction();
console.log('-------------------------------------');

testWorksheetStructure();
console.log('-------------------------------------');

testInputValidation();
console.log('-------------------------------------');

testErrorHandling();
console.log('-------------------------------------');

testHTMLGeneration();
console.log('-------------------------------------');

console.log('All tests completed. Check the console for results.');
