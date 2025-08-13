# Worksheet Validation System

This document explains the self-contained validation system used in the Elve-Cursor worksheets.

## Overview

Each worksheet problem now includes its own validation logic, making worksheets completely self-contained. This eliminates the need for hardcoded validation in the main application code and makes it easier to create new worksheets.

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

## Validation Types

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

## Example Problem with Validation

```json
{
  "id": "1.2",
  "type": "practice",
  "title": "Your First Print",
  "content": "Now try printing your own message!",
  "task": "Write a program that prints \"My name is [your name]\"",
  "starterCode": "# Write your code here\n",
  "expectedOutput": "My name is [any name]",
  "hint": "Replace [your name] with your actual name in quotes",
  "validation": {
    "type": "pattern_match",
    "rules": [
      {
        "type": "code_contains",
        "pattern": "print",
        "description": "Code must contain a print statement"
      },
      {
        "type": "code_contains",
        "pattern": "My name is",
        "description": "Code must contain 'My name is'"
      },
      {
        "type": "output_contains",
        "pattern": "My name is",
        "description": "Output must contain 'My name is'"
      },
      {
        "type": "code_min_length",
        "minLength": 20,
        "description": "Code must be substantial (not just comments)"
      }
    ]
  }
}
```

## Creating New Worksheets

1. Use the `template.json` file as a starting point
2. Add validation rules to each problem based on the learning objectives
3. Test the validation rules thoroughly
4. Ensure the validation is neither too strict nor too lenient

## Benefits

- **Self-contained**: Each worksheet contains its own validation logic
- **Maintainable**: No need to modify main application code for new worksheets
- **Flexible**: Easy to create custom validation rules for specific problems
- **Documented**: Clear descriptions of what each validation rule checks
- **Extensible**: New validation rule types can be easily added

## Fallback Behavior

If a problem doesn't include validation rules, the system falls back to basic validation:
- Code must be at least 10 characters long (excluding comments)
- Output must not be empty
- No Python errors should occur
