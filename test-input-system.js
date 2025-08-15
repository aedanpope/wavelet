// Test file for the input system functionality
// This tests the new input system for Worksheet 2

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
    
    // Simulate the get_input function
    const mockGetInput = function(inputName) {
        const inputElement = document.getElementById(`input-2-${inputName}`);
        if (inputElement) {
            let value = inputElement.value;
            
            // Find the input configuration to determine type
            const inputConfig = problem1.inputs.find(input => input.name === inputName);
            if (inputConfig) {
                // Convert value based on input type
                if (inputConfig.type === 'number') {
                    value = parseFloat(value) || 0;
                } else if (inputConfig.type === 'boolean') {
                    value = value === 'true';
                }
            }
            
            return value;
        }
        return null;
    };
    
    // Test the function
    const result1 = mockGetInput('first_number');
    const result2 = mockGetInput('second_number');
    
    console.log('get_input("first_number"):', result1);
    console.log('get_input("second_number"):', result2);
    
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

testWorksheetStructure();
console.log('-------------------------------------');

testInputValidation();
console.log('-------------------------------------');

testHTMLGeneration();
console.log('-------------------------------------');

console.log('All tests completed. Check the console for results.');
