# Worksheets Directory

This directory contains all Wavelet worksheet definitions and the JSON Schema for validating them.

## Files

- **`schema.json`** - JSON Schema defining the structure and validation rules for worksheets
- **`index.json`** - Master index of all available worksheets
- **`worksheet-N.json`** - Individual worksheet files (N = 1, 2, 3, etc.)
- **`template.json`** - Template for creating new worksheets
- **`dev-index.json`** - Development worksheet index (if present)

## Worksheet Validation

All worksheets are automatically validated against `schema.json` before building or testing.

### Running Validation Manually

```bash
npm run validate:worksheets
```

### Validation Integration

Validation runs automatically as part of:
- `npm run build` - Pre-build validation (blocks deployment if invalid)
- `npm run test:all` - Pre-test validation

### What Gets Validated

The schema validates:

**Worksheet Structure:**
- Required fields: `id`, `title`, `description`, `problems`
- ID format: must match `worksheet-[0-9]+`
- At least one problem per worksheet

**Problem Structure:**
- Required fields: `title`, `task`
- Optional fields: `content`, `starterCode`, `hint`, `codeHeight`, `difficulty`, `inputs`, `validation`

**Input Configurations:**
- Required fields: `name`, `label`, `type`
- Valid input types: `number`, `text`
- Name pattern: `^[a-z_][a-z0-9_]*$` (valid Python identifier)

**Validation Rules:**
All validation rule types and their required properties:

| Type | Required Properties | Optional Properties | Description |
|------|-------------------|-------------------|-------------|
| `code_contains` | `pattern` | `message`, `description` | Code must contain exact string |
| `code_not_contains` | `pattern` | `message`, `description` | Code must NOT contain string |
| `code_contains_regex` | `pattern` | `message`, `description` | Code must match regex pattern |
| `output_contains` | `pattern` | `message`, `description` | Output must contain exact string |
| `output_contains_regex` | `pattern` | `message`, `description` | Output must match regex pattern |
| `output_not_empty` | - | `message`, `description` | Output must not be empty |
| `solution_code` | `solutionCode` | `exactMatch`, `testInputs`, `message`, `description` | Compare against solution code |
| `code_min_length` | `minLength` | `message`, `description` | Code must be at least N characters |
| `print_count` | - | `minCount`, `maxCount`, `message`, `description` | Count of print statements |
| `output_line_count` | - | `minLines`, `maxLines`, `message`, `description` | Count of output lines |
| `assignment_count` | - | `minCount`, `maxCount`, `message`, `description` | Count of variable assignments |
| `input_count` | `count` | `message`, `description` | Count of get_input() calls |
| `code_contains_number` | `number` | `message`, `description` | Code must contain specific number |
| `output_is_number` | - | `message`, `description` | Output must be a number |
| `no_errors` | - | `message`, `description` | Code must run without errors |

### Common Validation Errors

**Missing Required Field:**
```
Error: must have required property 'title'
Path: /problems/0
```
**Fix:** Add the missing required field to the problem.

**Invalid Validation Rule Type:**
```
Error: must match exactly one schema in oneOf
Path: /problems/5/validation/rules/0
```
**Fix:** Check that the rule type is spelled correctly and all required properties are present.

**Invalid Input Name:**
```
Error: must match pattern "^[a-z_][a-z0-9_]*$"
Path: /problems/10/inputs/0/name
```
**Fix:** Input names must be valid Python identifiers (lowercase, start with letter or underscore).

**Additional Properties Not Allowed:**
```
Error: must NOT have additional properties
Path: /problems/3/validation/rules/1
Details: additionalProperty: "foo"
```
**Fix:** Remove the extra property or check the schema for allowed properties.

## Creating New Worksheets

1. Copy `template.json` to `worksheet-N.json` (N = next worksheet number)
2. Update worksheet metadata (`id`, `title`, `description`)
3. Add problems following the existing structure
4. Run validation: `npm run validate:worksheets`
5. Fix any validation errors
6. Add worksheet to `index.json`
7. Test the worksheet in the app
8. Run build: `npm run build`

## Best Practices

### Validation Rules
- Always include at least one validation rule per problem
- Use `solution_code` for most problems (most robust validation)
- Combine multiple rules for complex validation (all must pass)
- Provide helpful `message` fields for failed validations

### Input Configurations
- Use descriptive input names that match the problem context
- For single-input problems, students can use `get_input()` without arguments
- For multiple inputs, students must specify the input name: `get_input('name')`

### Problem Design
- Include `content` field to explain concepts
- Include `hint` field to help struggling students
- Use `starterCode` to scaffold difficult problems
- Set `codeHeight` for problems with longer expected solutions

### Code Examples in Content/Task
- Wrap inline code with `<code>` tags: `<code>get_input()</code>`
- Use simple, clear language appropriate for 11-year-olds
- Show examples before asking students to write from scratch

## Troubleshooting

### Validation Fails But I Can't Find the Error
The validation script shows the problem index and path. Use these to locate the issue:
- `Path: /problems/5/validation/rules/0` = Problem #6 (0-indexed), first validation rule
- Check the line numbers in the error output
- Compare against working examples in other worksheets

### Schema Doesn't Support My Validation Rule
The schema is based on actual usage in existing worksheets. If you need a new validation rule type:
1. Implement the rule in `validation.js` first
2. Add it to `schema.json` in the `validationRule` oneOf array
3. Document it in this README
4. Test it against existing worksheets

### Validation is Too Strict
The schema enforces structure to catch errors early. If a restriction is too strict:
1. Check if it's actually catching a real problem
2. If it's a false positive, consider adjusting the schema
3. Document any changes in this file
4. Test against ALL worksheets after schema changes

## Technical Details

### Schema Format
The schema uses [JSON Schema Draft 07](http://json-schema.org/draft-07/schema) specification.

### Validator
Validation is performed using [AJV (Another JSON Validator)](https://ajv.js.org/) v8.x, which supports Draft 07 and is fast, standards-compliant, and provides detailed error messages.

### Integration Points
- **`scripts/validate-worksheets.js`** - Validation script
- **`package.json`** - NPM scripts integration
- **`prebuild` hook** - Blocks deployment of invalid worksheets
- **`test:all` hook** - Ensures tests run against valid worksheets

## Additional Resources

- [Worksheet Design Guide](WORKSHEET-DESIGN.md) - Best practices for creating effective worksheets
- [Template](template.json) - Starting point for new worksheets
- [Validation Module](../validation.js) - Runtime validation implementation
- [Task 6](../tasks/TASK_6.md) - Decision rationale for JSON Schema approach
