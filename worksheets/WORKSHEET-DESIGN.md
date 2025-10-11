# Worksheet Design Guide

This document captures best practices and lessons learned from developing Wavelet worksheets, particularly from Worksheet 5 development.

## Table of Contents
- [Question Structure & Flow](#question-structure--flow)
- [Validation Best Practices](#validation-best-practices)
- [Pedagogical Principles](#pedagogical-principles)
- [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
- [Code Examples](#code-examples)

---

## Question Structure & Flow

### Difficulty Distribution (30/30/30)
Aim for approximately 20-25 questions per worksheet:
- **30% Easy (8 questions)** - Building confidence and basic understanding
- **30% Medium (8 questions)** - Reinforcing concepts with moderate challenge
- **30% Hard (8 questions)** - Stretching abilities and problem-solving
- **1-2 Creative/Challenge** - Open-ended exploration or synthesis

### Problem Type Progression: Run → Edit → Write
For each new concept, follow this sequence:
1. **Run/Observe** - Students see the concept in action
2. **Edit** - Students modify existing code to practice
3. **Write** - Students create from scratch

**Example from WS5 (break keyword):**
- Q23: Run code with break (observe)
- Q24: Add if + break to existing loop (edit)
- Q25: Add flag variable to existing code (edit)
- Q26: Write prime checker from scratch (write)

### Intersperse Review Questions
**Don't block review questions together.** Instead, strategically place them between new content:
```
✅ Good Flow:
- New: String basics (Q1-3)
- Review: Loop reminder (Q4)
- New: Loops + strings (Q5)
- Review: If statement reminder (Q6)
- New: If + strings (Q7)

❌ Bad Flow:
- New: String basics (Q1-5)
- Review: All WS1-4 review (Q6-12)
- New: Advanced strings (Q13-20)
```

### Starter Code Strategy
**Provide starter code when:**
- Introducing complex syntax students haven't seen
- Students would spend time retyping the same structure
- Focus should be on one specific edit/addition
- Variable names differ from previous examples

**Example:** "If statements with f-strings" - provide `n = get_input()` so students focus on the new skill (combining if/else with f-strings), not remembering variable names.

---

## Validation Best Practices

### Use solution_code as Primary Validation
**Always prefer `solution_code` over complex regex checks.**

```json
✅ Good:
{
  "validation": {
    "rules": [
      {
        "type": "solution_code",
        "solutionCode": "n = get_input()\nif n > 10:\n  print(f\"{n} is big\")\nelse:\n  print(f\"{n} is small\")",
        "testInputs": [
          {"inputs": {"n": 11}},
          {"inputs": {"n": 10}}
        ]
      }
    ]
  }
}

❌ Bad:
{
  "validation": {
    "rules": [
      {"type": "code_contains", "pattern": "get_input()"},
      {"type": "code_contains", "pattern": "if"},
      {"type": "code_contains", "pattern": ">"},
      {"type": "code_contains", "pattern": "f\""},
      {"type": "output_contains_regex", "pattern": "(big|small)"}
    ]
  }
}
```

### testInputs Don't Need expectedOutput
The validation system automatically uses solution code output if `expectedOutput` is not specified:

```json
✅ Clean:
"testInputs": [
  {"inputs": {"n": 11}},
  {"inputs": {"n": 10}}
]

❌ Redundant:
"testInputs": [
  {"inputs": {"n": 11}, "expectedOutput": "11 is big"},
  {"inputs": {"n": 10}, "expectedOutput": "10 is small"}
]
```

### When to Use code_contains Checks
Use sparingly, only to provide helpful early feedback on specific patterns:

```json
✅ Good - Helpful early checks before solution_code:
{
  "rules": [
    {"type": "code_contains", "pattern": "break"},
    {"type": "code_contains", "pattern": "%"},
    {"type": "solution_code", "solutionCode": "..."}
  ]
}

✅ Also Good - Let solution_code errors teach:
{
  "rules": [
    {"type": "solution_code", "solutionCode": "..."}
  ]
}
```

**When to skip code_contains:** If students can learn better from seeing output differences (e.g., "Expected: Found it! / Your output: Not found") rather than checklist errors.

### Add Descriptions to Regex Patterns
If you must use `code_contains_regex`, always add a `description`:

```json
✅ Good:
{
  "type": "code_contains_regex",
  "pattern": "print\\s*\\(\\s*f\".*\\{name\\}.*\"\\s*\\)",
  "description": "Use an f-string with {name} in the print statement"
}

❌ Bad:
{
  "type": "code_contains_regex",
  "pattern": "print\\s*\\(\\s*f\".*\\{name\\}.*\"\\s*\\)"
}
// Students see: ❌ Code must contain: print ( f".*\{name\}.*" )
```

### Test Boundary Cases
For problems with conditions, always test edge cases:

```json
// For "if score >= 50:"
"testInputs": [
  {"inputs": {"score": 50}},   // Boundary: exactly at threshold
  {"inputs": {"score": 49}},   // Boundary: just below
  {"inputs": {"score": 60}},   // Above threshold
  {"inputs": {"score": 0}}     // Well below
]
```

### Arithmetic Problems Need Specific Validation
For "write a program to calculate X + Y" problems, students could just hardcode the answer:

```json
✅ Good - Prevents print(35):
{
  "rules": [
    {"type": "code_contains", "pattern": "print"},
    {"type": "code_contains", "pattern": "15"},
    {"type": "code_contains", "pattern": "20"},
    {"type": "code_contains", "pattern": "+"},
    {"type": "solution_code", "solutionCode": "print(15 + 20)"}
  ]
}
```

---

## Pedagogical Principles

### Introduce One Concept at a Time
**Don't mix too many new concepts in one question.**

```
✅ Good progression:
Q1: Introduce f-strings with static string
Q2: Edit f-string to change greeting
Q3: Use f-string with number variable
Q4: Use f-string with input

❌ Bad:
Q1: Use f-strings with input, loops, and if statements
```

### Build Prerequisites First
**Ensure students have learned dependencies before combining concepts.**

Example from WS5:
1. Learn modulo operator (Q19: Finding Remainder)
2. Apply to even/odd (Q20: Even or Odd?)
3. Apply to factors (Q22: Finding Factors)
4. Learn break keyword (Q23-25)
5. Combine all: prime detection (Q26)

### Use "Bug Fix" Questions for Common Mistakes
Include intentional bugs that students commonly make:

**Examples:**
- **Quote bug**: `print('I'm happy')` → Learn about quote matching
- **Indentation matters** (WS3): Learn about Python's indentation
- **= vs ==**: Show assignment vs comparison error

### Avoid Overly Complex or Tricky Patterns
**for-else is way too tricky** for primary students. Use flag variables instead:

```python
# ❌ Too advanced (for-else):
for i in range(2, n):
  if n % i == 0:
    print("Composite")
    break
else:  # Python-specific, confusing
  print("Prime")

# ✅ Clear (flag variable):
is_composite = False
for i in range(2, n):
  if n % i == 0:
    is_composite = True
    break

if is_composite:
  print("Composite")
else:
  print("Prime")
```

### Remove Unnecessary Busywork
**Cut questions that:**
- Repeat the same concept too many times without adding value
- Require excessive typing without teaching new skills
- Are overly similar to previous questions

**Example:** "Three greetings" was almost cut for being busywork, but kept because it teaches **variable reuse** - that's valuable!

### Make Review Questions Relevant
**Don't just repeat old problems.** Integrate review with new concepts:

```
❌ Bad: "Write a program that gets two numbers and adds them" (pure WS2 review)

✅ Good: "Get two numbers and print the result with an f-string: '{x} + {y} = {result}'"
(Reviews WS2 but practices new WS5 concept)
```

---

## Common Pitfalls to Avoid

### 1. Messy Output in Practice Questions
**Problem:** Print statements that make output hard to read.

```python
❌ Bad (messy output):
for i in range(1, 100):
  if i > target:
    print(f"Found: {i}")  # Shows number, clutters output
    found = True
    break

✅ Good (clean output):
for i in range(1, 100):
  if i > target:
    found = True  # Just set flag
    break

if found:
  print("Found it!")  # Simple, clear message
```

### 2. Wrong codeHeight
**Always count the lines in your solution code including blank lines:**
- Starter code with 10 lines → `codeHeight: 10`
- Solution has 12 lines → `codeHeight: 12`

### 3. Variable Name Inconsistency
**Problem:** Switching variable names confuses students.

```python
❌ Confusing:
Q1: "score = get_input()" ... if score >= 50:
Q2: "Write a program with if n > 10:"
// Why did 'score' become 'n'??

✅ Consistent - Either:
- Provide starter code with the new variable name
- Use the same variable name pattern
- Explain why the name changed
```

### 4. Bypassing Validation
**Test that students can't cheat:**
- Can they hardcode the output? (Add solution_code)
- Can they add print at the top instead of in the right place? (Use solution_code)
- Can they skip the condition? (Use testInputs with boundary cases)

### 5. Too Much Scaffolding vs Too Little
**Find the right balance:**

```
Too much: Give all code, student just changes one word
Too little: Empty starter code for complex multi-concept problem
Just right: Give structure, student implements logic
```

**Example:**
- Easy: Give loop + if structure, student adds one line
- Medium: Give loop, student adds if + logic
- Hard: Give nothing, student writes loop + if + logic

---

## Code Examples

### Template for Edit Questions

```json
{
  "title": "Descriptive Title",
  "content": "Brief explanation of what concept we're practicing.",
  "task": "Specific instruction: Add X to make Y happen.",
  "inputs": [
    {"name": "n", "label": "Enter a number:", "type": "number"}
  ],
  "codeHeight": 8,
  "starterCode": "n = get_input()\n\n# Student edits here\nprint(n)",
  "hint": "Concrete guidance without giving away the answer.",
  "validation": {
    "rules": [
      {
        "type": "solution_code",
        "solutionCode": "n = get_input()\n\nif n > 10:\n  print(\"Big\")\n\nprint(n)",
        "testInputs": [
          {"inputs": {"n": 11}},
          {"inputs": {"n": 5}}
        ]
      }
    ]
  }
}
```

### Template for Write Questions

```json
{
  "title": "Challenge Title",
  "content": "Explain the goal and any new concepts needed.",
  "task": "Write a program that does X. Use Y and Z concepts.",
  "inputs": [
    {"name": "value", "label": "Enter value:", "type": "number"}
  ],
  "codeHeight": 10,
  "starterCode": "",
  "hint": "Break down the steps or suggest an approach without giving code.",
  "validation": {
    "rules": [
      {
        "type": "code_contains",
        "pattern": "key_concept",
        "description": "Use the key concept from this lesson"
      },
      {
        "type": "solution_code",
        "solutionCode": "value = get_input()\n\n# Full solution here",
        "testInputs": [
          {"inputs": {"value": 10}},
          {"inputs": {"value": 5}},
          {"inputs": {"value": 0}}
        ]
      }
    ]
  }
}
```

### Template for Observe/Run Questions

```json
{
  "title": "Meet the X",
  "content": "This is X. It does Y. Here's how it works...",
  "task": "Run this code and observe how X works. Try changing Z.",
  "codeHeight": 5,
  "starterCode": "# Working code demonstrating concept\nprint(\"Hello\")",
  "hint": "Notice how when you change A, B happens.",
  "validation": {
    "rules": [
      {
        "type": "solution_code",
        "solutionCode": "# Same as starter code\nprint(\"Hello\")"
      }
    ]
  }
}
```

---

## Quick Checklist for New Questions

Before adding a question to a worksheet, verify:

- [ ] Question has clear learning objective (what concept does it teach/practice?)
- [ ] Difficulty is appropriate for its position in the worksheet
- [ ] Follows Run→Edit→Write progression for new concepts
- [ ] Starter code is provided when needed (complex syntax, focus on one skill)
- [ ] codeHeight matches the actual solution line count
- [ ] Validation uses solution_code with testInputs
- [ ] Regex patterns have clear description fields (if used)
- [ ] Boundary cases are tested in testInputs
- [ ] Variable names are consistent with surrounding questions
- [ ] Output is clean and not messy (no excessive print statements)
- [ ] Hint gives guidance without giving away the answer
- [ ] Can't be bypassed with hardcoded values or trivial solutions

---

## Notes for Future Development

### What Worked Well in WS5
- **Flag variables over for-else**: Clearer, more transferable pattern
- **Interspersed review**: Kept pacing good, prevented fatigue
- **Break keyword progression**: Run→Edit→Edit→Write was perfect
- **Factors → Prime**: Natural, motivating build-up to final challenge
- **Quote bug as teaching moment**: Like "Indentation matters" in WS3
- **Removing busywork**: Kept worksheet focused and engaging

### What to Avoid in Future
- **for-else pattern**: Too Python-specific and confusing
- **Blocking review questions**: Makes worksheet feel disjointed
- **Too many similar questions**: Cut repetitive exercises
- **Messy debug output**: Keep output clean in practice questions
- **Complex validation without solution_code**: Regex chains are fragile

### Question Ideas for Future Worksheets
- **WS6**: Lists, indexing, len(), append()
- **WS7**: While loops, continue keyword
- **WS8**: Functions (def, parameters, return)
- **WS9**: String methods (.upper(), .lower(), .strip(), .split())
- **WS10**: Dictionaries, key-value pairs

---

*Last updated: 2025-01-27*
*Based on: Worksheet 5 development session*
