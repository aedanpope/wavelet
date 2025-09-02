# Worksheet Validation System

This document explains the enhanced validation system used in the Wavelet-Zone worksheets, which now prioritizes **black-box testing** over pattern matching for more robust and educational validation.

## Overview

The validation system has been designed to focus on **"testing what the code does, not how it's written"**. This approach eliminates the fragility of regex patterns and provides students with better feedback about their solutions.

## Core Philosophy

**Black-Box First Approach**: Instead of checking syntax patterns, we test the actual behavior of student code against expected outputs across multiple scenarios using seed-based deterministic testing.

## Validation Structure

Each problem in a worksheet can include a `validation` object with the following structure:

```json
{
  "validation": {
    "type": "exact_match|pattern_match",
    "rules": [
      {
        "type": "rule_type",
        "pattern": "pattern_value",
        "description": "Human-readable description of what this rule checks"
      }
    ]
  }
}
```

## New: Solution Code Validation (Recommended)

The most powerful validation type is `solution_code`, which compares student code behavior against a reference solution:

```json
{
  "validation": {
    "rules": [
      {
        "type": "solution_code",
        "solutionCode": "choice = get_choice(2)\nif choice == 1:\n  print(\"You chose the Wizard!\")\nelse:\n  print(\"You chose the Warrior!\")",
        "maxRuns": 10
      }
    ]
  }
}
```

### How Solution Code Validation Works

1. **Seed-Based Testing**: Executes both student and solution code with the same deterministic inputs
2. **Dynamic Input Generation**: `get_choice()` and `get_input()` functions generate test values from seeds
3. **Behavioral Comparison**: Compares outputs across multiple test scenarios
4. **Educational Feedback**: Provides specific information about which test cases failed

### Example Test Execution

**Seed 1**: `get_choice(2)` returns 1 → Expected: "You chose the Wizard!"
**Seed 2**: `get_choice(2)` returns 2 → Expected: "You chose the Warrior!"
**Seed 3**: `get_choice(2)` returns 1 → Expected: "You chose the Wizard!"
... (continues with different seeds)

### Benefits of Solution Code Validation

- **Robust**: Works regardless of variable names, spacing, or syntax variations
- **Educational**: Students see exactly which scenarios their code fails
- **Maintainable**: No need to update regex patterns when requirements change
- **Comprehensive**: Tests multiple execution paths automatically

## Traditional Validation Types (Legacy)

### `exact_match`
Used when the code must match specific patterns exactly. All rules must pass for validation to succeed.

### `pattern_match`
Used when the code should match certain patterns but allows for flexibility. All rules must pass for validation to succeed.

## Available Validation Rules

### `code_contains`
Checks if the student's code contains a specific pattern.

```json
{
  "type": "code_contains",
  "pattern": "print(",
  "description": "Code must contain a print statement"
}
```

### `code_contains_regex`
Checks if the student's code matches a regex pattern (more flexible than `code_contains`).

```json
{
  "type": "code_contains_regex",
  "pattern": "get_input\\s*\\(\\s*['\"]name['\"]\\s*\\)",
  "description": "Code must use get_input() with the parameter 'name'"
}
```

### `output_contains`
Checks if the program output contains a specific pattern.

```json
{
  "type": "output_contains",
  "pattern": "Hello, World!",
  "description": "Output must contain 'Hello, World!'"
}
```

### `code_min_length`
Ensures the code has a minimum length (excluding comments).

```json
{
  "type": "code_min_length",
  "minLength": 20,
  "description": "Code must be substantial (not just comments)"
}
```

### `print_count`
Counts the number of print statements in the code.

```json
{
  "type": "print_count",
  "minCount": 2,
  "description": "Must have at least 2 print statements"
}
```

### `output_line_count`
Counts the number of non-empty lines in the output.

```json
{
  "type": "output_line_count",
  "minLines": 3,
  "description": "Output must have at least 3 lines"
}
```

### `assignment_count`
Counts the number of variable assignments (=) in the code.

```json
{
  "type": "assignment_count",
  "minCount": 2,
  "description": "Must have at least 2 variable assignments"
}
```

### `input_count`
Counts the number of input() function calls in the code.

```json
{
  "type": "input_count",
  "minCount": 3,
  "description": "Must have at least 3 input() calls"
}
```

### `code_contains_number`
Uses a regex pattern to check for number assignments.

```json
{
  "type": "code_contains_number",
  "pattern": "age\\s*=\\s*\\d+",
  "description": "Age must be assigned a number value"
}
```

### `output_is_number`
Checks if the first non-empty output line is a number.

```json
{
  "type": "output_is_number",
  "description": "Output must be a number"
}
```

### `output_not_empty`
Ensures the output is not empty.

```json
{
  "type": "output_not_empty",
  "description": "Output must not be empty"
}
```

### `no_errors`
Checks that the output doesn't contain error messages.

```json
{
  "type": "no_errors",
  "description": "Code must not produce errors"
}
```

## Example Problem with Enhanced Validation

```json
{
  "id": "4.1",
  "type": "practice",
  "title": "Height Checker",
  "content": "Write a program that checks if someone can ride based on their height.",
  "task": "Get the user's height and print 'You can ride!' if they are tall enough (over 140cm).",
  "starterCode": "# Write your code here\n",
  "expectedOutput": "You can ride!",
  "hint": "Use get_input() to get the height, then use an if statement to check if it's greater than 140.",
  "validation": {
    "rules": [
      {
        "type": "solution_code",
        "solutionCode": "height = get_input()\nif height > 140:\n  print(\"You can ride!\")",
        "maxRuns": 5
      }
    ]
  }
}
```

## Enhanced Error Messages

The new system provides much better feedback when validation fails:

### Single Test Failure
```
❌ With input height = 150: got "You can ride!", expected "You can ride!"
```

### Multiple Test Failures
```
❌ Your program doesn't work correctly in 3 different test scenarios.

- With input height = 130: got "", expected "You can ride!"
- With input height = 150: got "You can ride!", expected "You can ride!"
- With input height = 200: got "You can ride!", expected "You can ride!"

Hint: Check your if condition - it should check if height > 140.
```

### Complex Scenarios (with choices and inputs)
```
❌ Your program doesn't work correctly in 2 different test scenarios.

- With input age = 15 and choice 1 (from 3 options): got "You are young", expected "You are a teenager"
- With input age = 25 and choice 2 (from 3 options): got "You are old", expected "You are an adult"
```

## Creating New Worksheets

### Recommended Approach (Solution Code Validation)
1. **Write the solution code** that demonstrates the expected behavior
2. **Add the solution_code validation rule** with appropriate `maxRuns` (default: 10)
3. **Test thoroughly** with different input scenarios
4. **Provide clear hints** that guide students toward the solution

### Legacy Approach (Pattern Matching)
1. Use the `template.json` file as a starting point
2. Add validation rules to each problem based on the learning objectives
3. Test the validation rules thoroughly
4. Ensure the validation is neither too strict nor too lenient

## Benefits of the New System

- **Robust**: No more false negatives due to syntax variations
- **Educational**: Students see exactly what went wrong and why
- **Maintainable**: No need to update regex patterns when requirements change
- **Comprehensive**: Automatically tests multiple execution paths
- **Fast**: Efficient seed-based testing with early termination
- **Flexible**: Works with any code structure or logic

## Technical Implementation

### Core Components
- **`validate-solution-code.js`**: Standalone module for solution code validation
- **`validation.js`**: Main validation orchestration (imports validate-solution-code)
- **Seed-based testing**: Deterministic input generation for reproducible tests
- **Dynamic function overrides**: `get_choice()` and `get_input()` during test execution

### File Structure
```
validation/
├── validate-solution-code.js   # Enhanced solution_code validation
├── validation.js               # Main validation orchestration
└── VALIDATION.md               # This documentation
```

## Migration from Old System

The new system is **fully backward compatible**. Existing worksheets with pattern-based validation will continue to work exactly as before. To upgrade:

1. **Replace pattern-based rules** with `solution_code` rules
2. **Add `maxRuns` parameter** to control test coverage (optional)
3. **Test the new validation** to ensure it catches the same issues
4. **Remove old pattern rules** once confident in the new approach

## Fallback Behavior

If a problem doesn't include validation rules, the system falls back to basic validation:
- Code must be at least 10 characters long (excluding comments)
- Output must not be empty
- No Python errors should occur

## Future Enhancements

### Phase 4: AST-Based Validation (Planned)
- **Code parsing and analysis**: Parse Python code into AST
- **Semantic validation**: Check for required code structures
- **Hybrid validation system**: Combine AST analysis with black-box testing

### Benefits of Future AST System
- **Structural validation**: Check for required code constructs regardless of formatting
- **Educational insights**: Identify specific misconceptions (e.g., using `=` instead of `==`)
- **Performance**: Fast structural checks before expensive behavioral tests
- **Maintainability**: Declarative validation rules instead of regex patterns
