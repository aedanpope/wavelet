# TASK_4: Fix Worksheet 4 >= Validation to Require Operator Change

## Problem Analysis

In worksheet 4, the problem "Greater Than or Equal To >=" (line 70-77) has a validation issue that allows students to bypass the learning objective. Currently, the validation uses `solution_code` which accepts any code that matches exactly:

```python
score = 50
if score >= 50:
  print("You passed")
else:
  print("Try again")
```

However, students can "cheat" by changing `score = 50` to `score = 60` (or any value > 50) instead of learning to use the `>=` operator. This defeats the educational purpose of teaching the `>=` operator.

**Root Cause**: The current validation only checks for exact code match, not whether the student actually learned to use the `>=` operator while keeping the original score value.

**Current problematic validation** (line 76):
```json
"validation": { "rules": [{ "type": "solution_code", "solutionCode": "score = 50\nif score >= 50:\n  print(\"You passed\")\nelse:\n  print(\"Try again\")" }] }
```

## Educational Impact

- **Primary Learning Objective**: Students should learn that `>=` includes the boundary value (50), unlike `>` which excludes it
- **Current Problem**: Students can avoid learning `>=` by increasing the score value
- **Desired Outcome**: Students must use `>=` operator while keeping `score = 50`

## Implementation Plan

**REVISED APPROACH** (based on user feedback):

Use targeted regex validation rules with custom error descriptions to ensure students learn the `>=` operator without being able to bypass it by changing the score value. This approach fixes the actual bug while providing clear educational feedback.

### Targeted Validation Rules

The validation will use multiple rules that work together:

1. **Score Value Preserved**: Ensure score remains exactly 50
2. **Operator Required**: Require the `>=` operator in the condition
3. **Structure Maintained**: Ensure the overall code structure is correct
4. **Output Verified**: Verify the correct output behavior

### Updated Problem Content

```json
{
  "title": "Greater Than or Equal To >=",
  "content": "What if you want to include the number in your check? You can use <code>>=</code> which means 'greater than or equal to'. This problem will help you practice using >= specifically.",
  "task": "Run the code with the score set to 50. It says 'Try again'. Change the <code>></code> to <code>>=</code> so that a score of exactly 50 is also a pass. Keep the score as 50 to practice how >= works differently from >.",
  "hint": "Just add an equals sign = after the greater than sign >. Notice how >= includes the boundary value (50) while > excludes it.",
  "validation": {
    "rules": [
      {
        "type": "no_errors"
      },
      {
        "type": "code_contains",
        "pattern": "score = 50",
        "description": "Keep the score as 50 to practice the >= operator. Don't change the score value."
      },
      {
        "type": "code_contains_regex",
        "pattern": "if\\s+score\\s*>=\\s*50\\s*:",
        "description": "Use the >= operator in your if statement: 'if score >= 50:'"
      },
      {
        "type": "code_contains_regex",
        "pattern": "^(?!.*score\\s*=\\s*(?!50\\b)\\d+).*$",
        "description": "Don't change the score value. Keep it as 50 to learn how >= works."
      },
      {
        "type": "output_contains",
        "pattern": "You passed",
        "description": "Your code should print 'You passed' when the score is 50 and you use >=."
      }
    ]
  }
}

## Files to Modify

- `/home/aedan/wavelet/worksheets/worksheet-4.json` - Lines 70-77, update the "Greater Than or Equal To >=" problem

## Testing Strategy

### Validation Rule Testing

Each rule will be tested with various student code attempts:

1. **Correct Solution** ✅
   ```python
   score = 50
   if score >= 50:
     print("You passed")
   else:
     print("Try again")
   ```

2. **Bypass Attempts** ❌ (Should fail with clear messages)
   ```python
   # Changing score to avoid learning >=
   score = 60
   if score > 50:
     print("You passed")
   else:
     print("Try again")
   # Fails: "Keep the score as 50 to practice the >= operator"
   ```

3. **Partial Solutions** ❌ (Should provide targeted guidance)
   ```python
   # Using >= but changed score
   score = 55
   if score >= 50:
     print("You passed")
   else:
     print("Try again")
   # Fails: "Don't change the score value. Keep it as 50 to learn how >= works."
   ```

4. **Missing Operator Change** ❌
   ```python
   score = 50
   if score > 50:
     print("You passed")
   else:
     print("Try again")
   # Fails: "Use the >= operator in your if statement: 'if score >= 50:'"
   ```

## Success Criteria

- Students must use `>=` operator to pass validation
- Students cannot bypass the lesson by changing the score value
- Clear, educational error messages guide students toward correct approach
- Validation prevents the specific bug identified (score value changes)
- Maintains educational flow while enforcing learning objectives

## Benefits of Regex Approach

1. **Fixes the Actual Bug**: Prevents score value changes that bypass learning
2. **Educational Error Messages**: Custom descriptions guide students correctly
3. **Targeted Validation**: Each rule addresses a specific aspect of the learning objective
4. **Clear Feedback**: Students understand exactly what needs to be changed
5. **Prevents Cheating**: Multiple rules work together to ensure proper learning

## Implementation Steps

1. Update the problem content in worksheet-4.json (lines 70-77)
2. Replace the `solution_code` validation with multiple targeted regex rules
3. Add custom error descriptions for each validation rule
4. Test the validation rules with various student code attempts
5. Verify error messages are clear and educational

## Validation Rules Breakdown

1. **`no_errors`** - Ensures code runs without Python errors
2. **`code_contains: "score = 50"`** - Prevents changing score value, shows: "Keep the score as 50 to practice the >= operator. Don't change the score value."
3. **`code_contains_regex: "if\\s+score\\s*>=\\s*50\\s*:"`** - Requires >= operator, shows: "Use the >= operator in your if statement: 'if score >= 50:'"
4. **`code_contains_regex: "^(?!.*score\\s*=\\s*(?!50\\b)\\d+).*$"`** - Negative lookahead to catch any score value other than 50, shows: "Don't change the score value. Keep it as 50 to learn how >= works."
5. **`output_contains: "You passed"`** - Verifies correct output behavior

---

## Revision Notes

**Feedback from `arch` agent incorporated, then user feedback:**

- **Arch Issue**: Original regex approach was deemed overly complex
- **Arch Solution**: Tried enhanced instructional design with `solution_code` validation
- **User Feedback**: Enhanced approach doesn't actually fix the bug - students can still bypass learning by changing score
- **Final Solution**: Return to regex approach but with improved error descriptions using the `description` field
- **Key Benefits**:
  - Actually fixes the identified bug
  - Provides clear, educational error messages
  - Uses existing validation infrastructure with descriptions
  - Prevents the specific bypass behavior identified