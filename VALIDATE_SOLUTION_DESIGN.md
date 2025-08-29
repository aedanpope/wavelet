# Validation System Redesign: Black-Box First Approach

## Overview
Improve the validation system to be more robust and educational, starting with black-box testing improvements for immediate impact on Worksheet 4, with AST-based validation planned for future phases.

## Current Problems with Validation System

### 1. Fragile Pattern Matching
- Regex patterns break with minor syntax variations (spacing, variable names)
- Students get frustrated when correct logic fails due to formatting
- High maintenance burden for pattern updates

### 2. Poor Error Messages
- Generic "pattern not found" messages don't help learning
- No explanation of what went wrong or how to fix it
- Students can't understand why their solution failed

### 3. Limited Coverage for Interactive Elements
- `get_choice()` validation relies on solution code comparison
- No systematic testing of different user interaction paths
- Hard to validate complex decision trees

### 4. Scalability Issues
- Each new problem type requires new validation patterns
- Manual creation of test cases is time-consuming
- No systematic approach to edge case testing

## Proposed Solution: Enhanced Black-Box Testing

### Core Philosophy
**"Test what the code does, not how it's written"**

Instead of checking syntax patterns, we test the actual behavior of student code against expected outputs across multiple scenarios.

### Key Components

#### 1. Dynamic Input Generation During Execution
The system dynamically generates inputs as the code runs, using a seed-based approach to explore different program paths:

```javascript
// Simple but effective PRNG for deterministic testing
function nextRandom(seed, index = 0) {
    const state = seed * 1000 + index;
    return ((state * 9301 + 49297) % 233280) / 233280;
}

// Override get_choice during test execution
function createTestGetChoice(seed, maxRuns = 10) {
    let choiceIndex = 0;
    const choicesUsed = [];
    
    const choiceFunction = function(n) {
        const randomValue = nextRandom(seed, choiceIndex);
        const choice = Math.floor(randomValue * n) + 1;
        
        // Track the choice that was made
        choicesUsed.push({
            choice: choice,
            maxChoices: n,
            index: choiceIndex
        });
        
        choiceIndex++;
        return choice;
    };
    
    // Store tracking data in closure scope (cleaner than attaching to function)
    choiceFunction.getTrackingData = () => ({ choicesUsed, seed });
    
    return choiceFunction;
}

// Override get_input during test execution
function createTestGetInput(problem, seed) {
    const inputValues = generateTestValuesFromSeed(problem.inputs, seed);
    let inputIndex = 0;
    const inputsUsed = [];
    
    const inputFunction = function(inputName) {
        const targetName = inputName || problem.inputs[0]?.name;
        const value = inputValues[targetName] || inputValues[inputIndex];
        
        // Track the input that was used
        inputsUsed.push({
            name: targetName,
            value: value,
            index: inputIndex
        });
        
        inputIndex++;
        return value;
    };
    
    // Store tracking data in closure scope (cleaner than attaching to function)
    inputFunction.getTrackingData = () => ({ inputsUsed, seed });
    
    return inputFunction;
}

// Generate test values from seed for deterministic testing
function generateTestValuesFromSeed(inputs, seed) {
    const values = {};
    let currentSeed = seed;
    
    inputs.forEach(input => {
        values[input.name] = generateValueFromSeed(input.type, currentSeed);
        currentSeed = Math.floor(currentSeed / 20) + 1;
    });
    
    return values;
}

// Generate a single test value from seed based on input type
function generateValueFromSeed(type, seed) {
    switch (type) {
        case 'number':
            // Prioritize simple values for low seeds (better error messages)
            const simpleNumbers = [0, 1, 2, 5, 10, -1, -5, 100, -100, 50];
            
            if (seed <= simpleNumbers.length) {
                return simpleNumbers[seed - 1]; // seed 1 = 0, seed 2 = 1, etc.
            } else {
                // For higher seeds, use RNG for more variety
                return Math.floor(nextRandom(seed) * 201) - 100; // -100 to 100
            }
            
        case 'boolean':
            // Simple alternating pattern for low seeds, then RNG
            if (seed <= 2) {
                return seed === 1; // seed 1 = false, seed 2 = true
            } else {
                return nextRandom(seed) < 0.5;
            }
            
        case 'string':
            // Simple strings for low seeds, then RNG
            const simpleStrings = ['hello', 'world', 'test', 'input', 'value', 'data', 'user', 'name', 'code', 'result'];
            
            if (seed <= simpleStrings.length) {
                return simpleStrings[seed - 1];
            } else {
                return simpleStrings[Math.floor(nextRandom(seed) * simpleStrings.length)];
            }
            
        default:
            // Default to simple number pattern
            return seed <= 10 ? seed - 1 : seed % 100;
    }
}
```

#### 2. Seed-Based Test Execution
Execute code multiple times with different seeds to explore various program paths:

```javascript
async function executeWithSeed(code, problem, seed, pyodideInstance) {
    // Override get_choice and get_input for this test run
    const testGetChoice = createTestGetChoice(seed);
    const testGetInput = createTestGetInput(problem, seed);
    
    // Set up the test environment
    pyodideInstance.globals.set('get_choice', testGetChoice);
    pyodideInstance.globals.set('get_input', testGetInput);
    
    // Execute and capture output
    let printOutput = '';
    const originalPrint = pyodideInstance.globals.get('print');
    pyodideInstance.globals.set('print', function(...args) {
        printOutput += args.join(' ') + '\n';
    });
    
    try {
        await pyodideInstance.runPythonAsync(code);
        
        // Capture the inputs that were actually used
        const inputTracking = testGetInput.getTrackingData();
        const choiceTracking = testGetChoice.getTrackingData();
        const inputsUsed = {
            inputs: inputTracking.inputsUsed,
            choices: choiceTracking.choicesUsed
        };
        
        return { 
            success: true, 
            output: printOutput, 
            seed,
            inputsUsed: inputsUsed
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message, 
            seed,
            inputsUsed: {
                inputs: testGetInput.getTrackingData().inputsUsed,
                choices: testGetChoice.getTrackingData().choicesUsed
            }
        };
    } finally {
        pyodideInstance.globals.set('print', originalPrint);
    }
}

async function runMultipleTests(studentCode, solutionCode, problem, maxRuns = 10) {
    const results = [];
    
    for (let seed = 1; seed <= maxRuns; seed++) {
        const studentResult = await executeWithSeed(studentCode, problem, seed, pyodideInstance);
        const solutionResult = await executeWithSeed(solutionCode, problem, seed, pyodideInstance);
        
        results.push({
            seed,
            studentResult,
            solutionResult,
            passed: studentResult.success && solutionResult.success && 
                   studentResult.output.trim() === solutionResult.output.trim()
        });
    }
    
    return results;
}
```

#### 3. Behavioral Comparison with Seed Tracking
Compare student output vs solution output across multiple seed-based executions:

```javascript
async function validateBehavior(studentCode, solutionCode, problem, maxRuns = 10) {
    const results = await runMultipleTests(studentCode, solutionCode, problem, maxRuns);
    
    const failedResults = results.filter(r => !r.passed);
    const passedResults = results.filter(r => r.passed);
    
    return {
        passed: failedResults.length === 0,
        totalTests: results.length,
        passedTests: passedResults.length,
        failedTests: failedResults.length,
        results: results,
        coverage: calculateCoverage(results),
        failedResults: failedResults
    };
}

function calculateCoverage(results) {
    const uniqueOutputs = new Set();
    results.forEach(r => {
        if (r.studentResult.success) {
            uniqueOutputs.add(r.studentResult.output.trim());
        }
    });
    
    return {
        uniqueOutputs: uniqueOutputs.size,
        totalRuns: results.length,
        successRate: results.filter(r => r.studentResult.success).length / results.length
    };
}
```

#### 4. Educational Error Messages with Seed Context
Provide specific, helpful feedback when tests fail, including information about the seed that caused the failure:

```javascript
function generateEducationalFeedback(failedResults, problem) {
    if (failedResults.length === 1) {
        const result = failedResults[0];
        const inputDescription = describeInputsForSeed(result.seed, problem, result.inputsUsed);
        return {
            type: 'specific_failure',
            message: `With ${inputDescription}, your program output: "${result.studentResult.output.trim()}" but expected: "${result.solutionResult.output.trim()}"`,
            hint: generateHint(result.seed, result.studentResult.output, result.solutionResult.output, problem)
        };
    } else {
        return {
            type: 'multiple_failures',
            message: `Your program doesn't work correctly in ${failedResults.length} different test scenarios.`,
            details: failedResults.map(r => {
                const inputDescription = describeInputsForSeed(r.seed, problem, r.inputsUsed);
                return `- With ${inputDescription}: got "${r.studentResult.output.trim()}", expected "${r.solutionResult.output.trim()}"`;
            })
        };
    }
}

function describeInputsForSeed(seed, problem, inputsUsed) {
    const parts = [];
    
    // Add get_input values if any were used
    if (inputsUsed.inputs && inputsUsed.inputs.length > 0) {
        const inputParts = inputsUsed.inputs.map(input => {
            if (input.name) {
                return `${input.name} = ${formatValue(input.value)}`;
            } else {
                return formatValue(input.value);
            }
        });
        parts.push(`input ${inputParts.join(', ')}`);
    }
    
    // Add get_choice values if any were used
    if (inputsUsed.choices && inputsUsed.choices.length > 0) {
        const choiceParts = inputsUsed.choices.map(choice => 
            `choice ${choice.choice} (from ${choice.maxChoices} options)`
        );
        parts.push(choiceParts.join(', '));
    }
    
    if (parts.length === 0) {
        return `test scenario ${seed}`;
    }
    
    return parts.join(' and ');
}

function formatValue(value) {
    if (typeof value === 'string') {
        return `"${value}"`;
    }
    return String(value);
}
```

### Implementation Plan

#### Phase 1: Core Black-Box Infrastructure (Week 1)
1. **Dynamic input function overrides**
   - Override `get_choice()` during test execution with seed-based choice generation
   - Override `get_input()` during test execution with seed-based value generation
   - Handle multiple consecutive calls to both functions

2. **Seed-based test execution system**
   - Execute code multiple times with different seeds (1 to maxRuns)
   - Use deterministic seed-to-input mapping for reproducible tests
   - Track execution results and compare student vs solution outputs

3. **Robust code execution with error handling**
   - Execute student and solution code with same seed values
   - Handle execution errors gracefully (syntax errors, runtime errors)
   - Capture and normalize output formatting for comparison

#### Phase 2: Enhanced Error Reporting (Week 2)
1. **Smart diff generation**
   - Highlight specific differences in output
   - Show context around differences
   - Suggest common fixes

2. **Educational feedback system**
   - Map failure patterns to learning objectives
   - Provide specific hints based on error type
   - Progressive hint system (start vague, get specific)

3. **Coverage reporting**
   - Show which scenarios passed/failed
   - Highlight edge cases that weren't tested
   - Suggest additional test cases

#### Phase 3: Worksheet 4 Optimization (Week 3)
1. **Optimize for decision-making problems**
   - Special handling for if/elif/else structures
   - Validate all code paths are reachable
   - Check for proper choice handling

2. **Performance optimization**
   - Cache solution code execution results
   - Parallel test execution where possible
   - Early termination on critical failures

### Example Usage for Worksheet 4

```json
{
  "validation": {
    "rules": [
      {
        "type": "solution_code",
        "solutionCode": "choice = get_choice(2)\nif choice == 1:\n  print(\"You chose the Wizard!\")\nelse:\n  print(\"You chose the Warrior!\")",
        "maxRuns": 10 // Test with 10 different seeds (optional, defaults to 10)
      }
    ]
  }
}
```

**Seed-Based Test Execution:**
- Seed 1: `get_choice(2)` returns 1 → Expected: "You chose the Wizard!"
- Seed 2: `get_choice(2)` returns 2 → Expected: "You chose the Warrior!"
- Seed 3: `get_choice(2)` returns 1 → Expected: "You chose the Wizard!"
- ... (continues with different seeds)

**Student Code:** `choice = get_choice(2)\nif choice == 1:\n  print("Wizard chosen")\nelse:\n  print("Warrior chosen")`

**Error Message:** 
```
❌ Your program doesn't work correctly in 10 different test scenarios.

- With choice 1 (from 2 options): got "Wizard chosen", expected "You chose the Wizard!"
- With choice 2 (from 2 options): got "Warrior chosen", expected "You chose the Warrior!"
- With choice 1 (from 2 options): got "Wizard chosen", expected "You chose the Wizard!"
- ... (showing all failed scenarios)

Hint: Check your print statements - they should match the expected output exactly.
```

**More Complex Example (with both inputs and choices):**
```
❌ Your program doesn't work correctly in 3 different test scenarios.

- With input age = 15 and choice 1 (from 3 options): got "You are young", expected "You are a teenager"
- With input age = 25 and choice 2 (from 3 options): got "You are old", expected "You are an adult"
- With input age = 65 and choice 3 (from 3 options): got "You are old", expected "You are a senior"
```

### Future Work: AST-Based Validation

#### Phase 4: AST Infrastructure (Future)
1. **Code parsing and analysis**
   - Parse Python code into AST
   - Extract structural patterns
   - Identify code constructs

2. **Semantic validation**
   - Check for required code structures
   - Validate variable usage patterns
   - Detect common misconceptions

3. **Hybrid validation system**
   - Combine AST analysis with black-box testing
   - Use AST for quick structural checks
   - Use black-box for behavioral validation

#### AST Benefits for Future
- **Structural validation**: Check for required code constructs regardless of formatting
- **Educational insights**: Identify specific misconceptions (e.g., using `=` instead of `==`)
- **Performance**: Fast structural checks before expensive behavioral tests
- **Maintainability**: Declarative validation rules instead of regex patterns

### Technical Implementation Details

#### File Structure
```
validation/
├── validate-solution-code.js   # Standalone solution_code validation (old + new logic)
├── validation.js               # Main validation orchestration (imports validate-solution-code)
├── ast/                        # Future work
│   ├── parser.js
│   ├── pattern-matcher.js
│   └── semantic-validator.js
└── VALIDATION.md                   # Documentation for validation system
```

#### API Design

**validate-solution-code.js** - Complete standalone module:
```javascript
// Simple but effective PRNG for deterministic testing
function nextRandom(seed, index = 0) {
    const state = seed * 1000 + index;
    return ((state * 9301 + 49297) % 233280) / 233280;
}

// Override get_choice during test execution
function createTestGetChoice(seed) {
    let choiceIndex = 0;
    
    return function(n) {
        const randomValue = nextRandom(seed, choiceIndex);
        const choice = Math.floor(randomValue * n) + 1;
        choiceIndex++;
        
        return choice;
    };
}

// Override get_input during test execution
function createTestGetInput(problem, seed) {
    const inputValues = generateTestValuesFromSeed(problem.inputs, seed);
    let inputIndex = 0;
    
    return function(inputName) {
        const targetName = inputName || problem.inputs[0]?.name;
        const value = inputValues[targetName] || inputValues[inputIndex];
        inputIndex++;
        return value;
    };
}

// Generate test values from seed for deterministic testing
function generateTestValuesFromSeed(inputs, seed) {
    const values = {};
    let currentSeed = seed;
    
    inputs.forEach(input => {
        values[input.name] = generateValueFromSeed(input.type, currentSeed);
        currentSeed = Math.floor(currentSeed / 20) + 1;
    });
    
    return values;
}

// Generate a single test value from seed based on input type
function generateValueFromSeed(type, seed) {
    switch (type) {
        case 'number':
            const simpleNumbers = [0, 1, 2, 5, 10, -1, -5, 100, -100, 50];
            if (seed <= simpleNumbers.length) {
                return simpleNumbers[seed - 1];
            } else {
                return Math.floor(nextRandom(seed) * 201) - 100;
            }
            
        case 'boolean':
            if (seed <= 2) {
                return seed === 1;
            } else {
                return nextRandom(seed) < 0.5;
            }
            
        case 'string':
            const simpleStrings = ['hello', 'world', 'test', 'input', 'value', 'data', 'user', 'name', 'code', 'result'];
            if (seed <= simpleStrings.length) {
                return simpleStrings[seed - 1];
            } else {
                return simpleStrings[Math.floor(nextRandom(seed) * simpleStrings.length)];
            }
            
        default:
            return seed <= 10 ? seed - 1 : seed % 100;
    }
}

// Execute code with specific seed
async function executeWithSeed(code, problem, seed, pyodideInstance) {
    const testGetChoice = createTestGetChoice(seed);
    const testGetInput = createTestGetInput(problem, seed);
    
    pyodideInstance.globals.set('get_choice', testGetChoice);
    pyodideInstance.globals.set('get_input', testGetInput);
    
    let printOutput = '';
    const originalPrint = pyodideInstance.globals.get('print');
    pyodideInstance.globals.set('print', function(...args) {
        printOutput += args.join(' ') + '\n';
    });
    
    try {
        await pyodideInstance.runPythonAsync(code);
        return { success: true, output: printOutput, seed };
    } catch (error) {
        return { success: false, error: error.message, seed };
    } finally {
        pyodideInstance.globals.set('print', originalPrint);
    }
}

// Run multiple tests with different seeds
async function runMultipleTests(studentCode, solutionCode, problem, maxRuns, pyodideInstance) {
    const results = [];
    
    for (let seed = 1; seed <= maxRuns; seed++) {
        const studentResult = await executeWithSeed(studentCode, problem, seed, pyodideInstance);
        const solutionResult = await executeWithSeed(solutionCode, problem, seed, pyodideInstance);
        
        results.push({
            seed,
            studentResult,
            solutionResult,
            passed: studentResult.success && solutionResult.success && 
                   studentResult.output.trim() === solutionResult.output.trim()
        });
    }
    
    return results;
}

// Main solution_code validation function
async function validateSolutionCode(studentCode, studentOutput, rule, problem, problemIndex, pyodideInstance) {
    // Check if we should use new seed-based approach
    if (rule.maxRuns) {
        // Use new seed-based testing
        const maxRuns = rule.maxRuns || 10;
        const results = await runMultipleTests(studentCode, rule.solutionCode, problem, maxRuns, pyodideInstance);
        
        const failedResults = results.filter(r => !r.passed);
        
        if (failedResults.length === 0) {
            return true; // All tests passed
        } else {
            // Generate educational feedback for failures
            const feedback = generateEducationalFeedback(failedResults, problem);
            console.log('Validation failed:', feedback);
            return false;
        }
    } else {
        // Use existing approach for backward compatibility
        return await validateWithLegacyApproach(studentCode, studentOutput, rule, problem, problemIndex, pyodideInstance);
    }
}

// Legacy validation approach (existing logic)
async function validateWithLegacyApproach(studentCode, studentOutput, rule, problem, problemIndex, pyodideInstance) {
    // Copy existing validateSolutionCode logic here for backward compatibility
    // This ensures old solution_code rules continue to work
}

// Educational feedback generation
function generateEducationalFeedback(failedResults, problem) {
    if (failedResults.length === 1) {
        const result = failedResults[0];
        return {
            type: 'specific_failure',
            message: `When test scenario ${result.seed}, your program output: "${result.studentResult.output}" but expected: "${result.solutionResult.output}"`,
            hint: `Check your program logic for scenario ${result.seed}`
        };
    } else {
        return {
            type: 'multiple_failures',
            message: `Your program doesn't work correctly in ${failedResults.length} different test scenarios.`,
            details: failedResults.map(r => 
                `- Test scenario ${r.seed}: got "${r.studentResult.output}", expected "${r.solutionResult.output}"`
            )
        };
    }
}

// Export for use in validation.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateSolutionCode };
} else if (typeof window !== 'undefined') {
    window.SolutionCodeValidator = { validateSolutionCode };
}
```

**validation.js** - Updated to import and use the new module:
```javascript
// Import the solution code validator
import { validateSolutionCode } from './validate-solution-code.js';

// In the validateRule function, the solution_code case now delegates to the new module
case 'solution_code':
    return await validateSolutionCode(code, output, rule, problem, problemIndex, pyodideInstance);
```

### Success Metrics

#### Immediate (Phase 1-3)
- **Reduced false negatives**: <5% of correct solutions marked wrong
- **Better error messages**: 90% of students understand what went wrong
- **Faster validation**: <2 seconds for complex problems
- **Worksheet 4 coverage**: All problems have robust validation

#### Long-term (Phase 4+)
- **Educational effectiveness**: Students learn faster with better feedback
- **Maintainability**: 50% reduction in validation rule maintenance
- **Scalability**: New problem types require minimal validation setup
- **Student satisfaction**: Reduced frustration with validation system

### Migration Strategy

1. **Parallel implementation**: Build new system alongside existing
2. **Gradual migration**: Start with Worksheet 4, then older worksheets
3. **Backward compatibility**: Keep existing validation rules working
4. **A/B testing**: Compare student success rates with new vs old system

### Risk Mitigation

1. **Performance**: Monitor execution time, optimize hot paths
2. **Reliability**: Comprehensive error handling, fallback to old system
3. **Complexity**: Start simple, add features incrementally
4. **Student confusion**: Clear migration messaging, gradual rollout

---

**Next Steps:**
0. Peform refactor extracting existing logic.
1. Implement Phase 1 core infrastructure
2. Test with Worksheet 4 problems
3. Iterate based on student feedback
4. Plan Phase 2 enhancements