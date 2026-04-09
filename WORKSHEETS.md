# Worksheet Authoring Guide

This document captures the design patterns, cadence, and editorial principles behind Wavelet's worksheets. It exists so that anyone (human or AI) creating a new worksheet can match the tone and pacing of the existing ones.

---

## Before You Start a New Worksheet

1. **Read every existing worksheet JSON** (worksheets/worksheet-1.json through the latest). Skim is not enough — you need to internalise the cadence, not just the topics.
2. **Check ROADMAP.md** for the agreed concept scope and any open decisions (e.g. "should slicing go in WS6 or WS8?").
3. **List which concepts students already know.** Every worksheet builds on the previous ones. Don't re-teach, but do provide brief "reminder" problems when you re-use a prior concept in a new context.
4. **Draft the concept sequence first** (see "Anatomy of a Worksheet" below) before writing any individual problems.

---

## Core Pedagogy

### The Run-Edit-Write-Apply Cycle

Every new sub-concept follows this four-step cycle. Not every step needs its own problem — some steps can be combined — but the order should be respected:

| Step | What the student does | Starter code? | Example (WS1, addition) |
|---|---|---|---|
| **Run** | Run pre-written code, observe output | Full | "Run `print(5 + 3)` and see the result" |
| **Edit** | Change one thing in working code | Full | "Change the numbers to get `50 + 25`" |
| **Write** | Write from scratch with clear spec | Empty or minimal | "Write a program to print `7 + 13`" |
| **Apply** | Use the concept in a word problem or combo | Empty | "Sarah has 6 apples and buys 9 more..." |

### Syntax Drill and Error Encounter Problems

This is one of the most effective patterns in the existing worksheets — **more than just "bug fixes."** The goal is to build muscle memory for new syntax AND teach students to recognise common error messages before they hit those errors while writing from scratch.

**Why this matters:** Classroom experience shows that when students jump straight from observing code to writing it, they get stuck on mechanical issues — missing brackets, missing colons, wrong indentation — not conceptual ones. These drill problems prevent that by isolating the mechanics.

There are three flavours:

1. **"Fix the broken code" problems** — code with a specific, common error. Students run it, see the error message, then fix it.
   - WS1: `print 30 + 20` (missing brackets) and `40 + 15` (missing `print` entirely)
   - WS3: `fro i in [1, 2, 3]:` (typo in `for`) and `for i in [1, 2, 3]` (missing colon)
   - WS4: `if choice = 5:` (single `=` instead of `==`)

2. **"Add the missing piece" problems** — almost-working code where students supply one syntactic element.
   - WS1: "This code calculates but doesn't print — wrap it in `print()`"
   - WS3: "Add spaces to put this line inside the loop" / "Remove spaces to put this line outside the loop"

3. **Indentation manipulation problems** — specifically for constructs with bodies (loops, if/else). These deserve multiple dedicated problems because indentation is the #1 source of errors in class.
   - WS3 has 3 problems just on indentation: "two things in one loop", "add indentation to put it inside", "remove indentation to put it outside"
   - WS4 has a concept card about double indentation (if inside for) because it's a new level of complexity

**When to include these:** For every new syntactic form a worksheet introduces, plan at least 1-2 syntax drill problems. Place them early in the sub-concept's problem sequence — after Run but before Write. The cycle becomes:

| Step | What the student does | Starter code? |
|---|---|---|
| **Run** | Run pre-written code, observe output | Full |
| **Edit** | Change one thing in working code | Full |
| **Fix/Drill** | Fix a broken version OR add a missing piece | Broken/incomplete |
| **Write** | Write from scratch with clear spec | Empty or minimal |
| **Apply** | Use the concept in a word problem or combo | Empty |

**For WS6 specifically:** Lists introduce new syntax (`[]`, `[0]`, `.append()`). Plan fix/drill problems for:
- `my_list[3]` on a 3-item list (IndexError — off by one, counting from 0)
- Missing `[]` around list items (e.g. `colours = "red", "blue"` without brackets)
- `my_list.append(x)` vs `my_list = my_list.append(x)` (returns None)
- Index confusion: accessing `my_list[i]` with wrong index

### Repetition Cadence

- Each new sub-concept gets **2-4 problems** before moving on.
- A "concept cluster" (e.g. all comparison operators in WS4) might have 8-12 problems total, but each individual operator (>, <, ==) only gets 2-3.
- **Don't rush.** If a concept is genuinely new (e.g. the first time students see a list), give it 3-4 problems. If it's a minor variation of something they already know (e.g. `<=` after they've seen `>=`), 1-2 is enough.
- The worksheet should end with 1-2 **challenge problems** (harder combos) and a **creative challenge** (open-ended, loosely validated).

### What Students Know at Each Stage

| After WS | Students can... |
|---|---|
| 1 | Use `print()`, do arithmetic (+, -, *, /), understand order of operations and brackets |
| 2 | Assign variables, use `get_input()` (single and named), do calculations with variables, use descriptive variable names |
| 3 | Write `for` loops with explicit lists and `range()`, use `range(start, stop)`, nest `print` inside loops, use the accumulator pattern (`total = total + i`), create text patterns with `'*' * n` |
| 4 | Use `if`/`elif`/`else`, all 6 comparison operators, `and`, `get_choice()` buttons, nest `if` inside `for`, use `%` modulo |
| 5 | Use strings with `""` and `''`, f-strings with `{var}`, string concatenation (`+`), `break` keyword, flag variables (`found = False`), combine all prior concepts (loops + if + strings + modulo) |

---

## Anatomy of a Worksheet

### Structure

Every worksheet follows this shape:

```
1. [Optional] Concept card introducing the big idea
2. [Optional] Trace element showing execution step-by-step
3. Run/observe problems for the first sub-concept
4. Edit problems
5. Write-from-scratch problems
6. Word problems / applications
7. [Repeat 1-6 for each sub-concept]
8. "Reminder" problems that re-introduce prior concepts before combining
9. Combination problems (new concept + old concepts)
10. Challenge problems (harder)
11. Creative challenge (open-ended, show your teacher)
```

### Concept Cards (`"type": "concept"`)

- Place **before** the first problem that uses a concept, not after.
- Keep them short — one key idea per card.
- Use the `examples` array for "You type X -> Python sees Y -> prints Z" when showing substitution.
- WS3 has 1 concept card, WS4 has 4. Use more when the concept is abstract (conditionals), fewer when it's concrete (arithmetic).

### Trace Elements (`"type": "trace"`)

- Show step-by-step execution for concepts where "what happens and in what order" is non-obvious.
- WS3 has 1 trace (basic for loop), WS4 has 3 (if true path, if false path, else path).
- Good candidates: first time a loop runs, first time an if/else branches, first time a list is iterated.

### Problem Counts

Existing worksheets have **24-30 problems** (excluding concept cards and traces). This is a good range. Don't exceed 30 — a worksheet should be completable in 1-2 class sessions.

### Difficulty Curve Within a Worksheet

- **First third (~8-10 problems):** Almost all Run and Edit. Starter code provided. One concept at a time. Students should be able to complete these without getting stuck.
- **Middle third (~8-10 problems):** Mix of Edit and Write. Concepts start combining. Bug-fix problems appear. Students may need hints.
- **Final third (~6-8 problems):** Mostly Write from scratch. Multi-concept combinations. Challenge problems. Students are expected to struggle a bit and use hints.

### Code Complexity Progression

| WS | Typical max lines (write from scratch) | Concepts combined |
|---|---|---|
| 1 | 1 line | Just `print()` + arithmetic |
| 2 | 3-5 lines | Variables + input + arithmetic |
| 3 | 3-5 lines | Loops + range + variables |
| 4 | 6-10 lines | Loops + if/elif/else + variables |
| 5 | 6-13 lines | All of the above + strings + break + flags |

Each worksheet adds about 2-3 lines to the maximum expected write-from-scratch length. Don't jump from 5-line programs to 15-line programs in a single worksheet.

---

## Editorial Principles

### Language and Tone

- **Talk to the student directly.** "Run the code" not "The student should run the code."
- **Keep content short.** The `content` field should be 1-3 sentences for most problems. Longer explanations go in concept cards.
- **Use concrete, relatable examples.** Apples, pizza, books, games — not abstract math.
- **Hints should unblock, not solve.** Give the shape of the answer, not the answer itself. Exception: early Run/Edit problems where the hint can be more explicit.

### What NOT to Do

- **Don't introduce more than one genuinely new concept per problem.** If a problem uses a new concept AND requires students to combine it with something they haven't practiced yet, split it into two problems.
- **Don't make the first problem of a new concept a Write-from-scratch.** Always let students see it working first.
- **Don't assume students will read concept cards carefully.** The first few problems after a concept card should reinforce exactly what the card explained.
- **Don't use jargon without explaining it.** "Boolean", "string", "modulo" are all introduced with plain-English explanations first.
- **Don't skip the fun.** Word problems, games, patterns, and creative challenges keep students engaged. Pure "write a program that prints X" gets boring.
- **Don't over-scope.** Each worksheet should teach ONE major concept (with sub-concepts). If you find yourself teaching two big ideas, you're probably building two worksheets.

### Validation Rules

- **Early problems (Run/Edit):** Use `solution_code` with tight matching. Students are following a recipe.
- **Middle problems (guided Write):** Use `solution_code` but also consider `testInputs` for input-based problems.
- **Challenge problems:** Relax validation. Use `output_contains`, `code_contains`, `output_not_empty`. The student might solve it differently than you expected.
- **Creative challenges:** Use the loosest possible validation — `code_contains` for the required construct (e.g. `for`), `output_not_empty`, and nothing else.

### "Reminder" Problems

When a worksheet uses a concept from a previous worksheet in a new combination, include a brief reminder problem:

- **WS5** has "Loop reminder" (problem 7) — a simple `for i in range(1, 6): print(i)` run-and-observe before combining loops with f-strings.
- **WS5** has "If statement reminder" (problem 12) — a simple if/else before combining with f-strings.
- These should be **1 problem max** per recalled concept. Don't re-teach — just give students a chance to recall.

---

## Worksheet-by-Worksheet Notes

### WS1: The Python Calculator (27 problems)

- **Concept:** `print()` and arithmetic operators.
- **Pattern:** Introduces each operator (+, -, *, /) in the same 4-step cycle: Run -> Edit -> Write -> Word problem.
- **Key design choice:** No variables, no strings. Just `print(expression)`. Students learn ONE thing: Python evaluates expressions.
- **Syntax drills (added from classroom experience):** Before students write `print()` from scratch, they fix `print 30 + 20` (missing brackets → SyntaxError) and fix `40 + 15` (missing `print` → no output). These two problems alone prevent the most common WS1 mistakes.
- **Final section:** Order of operations and brackets (6 problems). This is the "hard" part of WS1.
- **Note:** The word problems (apples, money, books, pizza, eggs, cookies) keep it grounded.

### WS2: Storing Your Numbers (24 problems)

- **Concept:** Variables and `get_input()`.
- **Sub-concepts introduced in order:** (1) Basic assignment, (2) Changing variables, (3) Two variables, (4) Variables in calculations, (5) `get_input()` single, (6) Calculations with input, (7) Multiple inputs, (8) Descriptive variable names.
- **Key design choice:** The concept card appears mid-worksheet (after problem 7) to explain variable substitution at the right moment.
- **Ends with:** Geometry problems (area, perimeter) that give purpose to descriptive names.

### WS3: Making Things Repeat (30 problems)

- **Concept:** `for` loops and `range()`.
- **Sub-concepts in order:** (1) Repetition problem (why loops?), (2) Basic for loop, (3) Modifying loops, (4) Loop variable, (5) Bug fixes (typo, colon), (6) Multiple statements in body, (7) Indentation (inside/outside), (8) Writing loops, (9) Looping over words, (10) `range()`, (11) `range(start, stop)`, (12) Interactive loops with input, (13) Calculations in loops, (14) Patterns, (15) Accumulator pattern, (16) Challenges.
- **Key design choice:** Opens with a concept card + trace before any coding. The trace shows exactly how `i` changes.
- **Syntax drills:** Typo fix (`fro` -> `for`), missing colon fix, and — most importantly — **3 dedicated indentation problems** (add indentation, remove indentation, multi-line body). These were added from classroom experience where students could understand loops conceptually but got stuck on the mechanics of indentation when writing their own. This is the model to follow: if a syntactic element causes friction in class, give it multiple drill problems.

### WS4: Making Decisions (30 problems)

- **Concept:** `if`/`elif`/`else` and comparisons.
- **Sub-concepts in order:** (1) True/False booleans, (2) `>` with practice, (3) `<` with practice, (4) `==` with practice, (5) Bug fix (= vs ==), (6) `else`, (7) `get_choice()` buttons, (8) `elif`, (9) All comparison operators reference, (10) `!=`, (11) `>=`, (12) Build from scratch (drink machine, quiz), (13) `and`, (14) Variables changing in if blocks, (15) Nesting if inside loops, (16) Modulo `%`, (17) Challenges (FizzBuzz).
- **Key design choice:** Each operator (>, <, ==, !=, >=) gets its own Run-then-Practice pair. The concept card lists all operators only AFTER students have practiced the main three.
- **Heaviest use of concept cards and traces** (4 cards, 3 traces) because branching logic is abstract.
- **Note:** Modulo (%) is introduced here AND reinforced in WS5. This cross-worksheet reinforcement is intentional.

### WS5: Working with Text (24 problems)

- **Concept:** Strings and f-strings.
- **Sub-concepts in order:** (1) Basic string printing, (2) f-strings, (3) Editing f-strings, (4) Single vs double quotes, (5) Quote bug fix, (6) Numbers in f-strings, (7) Loop reminder + loops with f-strings, (8) Writing f-strings from scratch, (9) f-strings with input, (10) String concatenation, (11) If statement reminder + if with f-strings, (12) Greeting programs, (13) Full introduction (name + age), (14) Modulo reminder + even/odd, (15) Even/odd with f-strings, (16) Finding factors (loop + if + f-string), (17) `break`, (18) Flag variables, (19) Prime number challenge.
- **Key design choice:** Uses "reminder" problems (simple loop, simple if) before combining with f-strings. This prevents cognitive overload.
- **Note:** `break` and flag variables are introduced here, not in WS4. This is because WS4 already has enough new concepts. Don't try to cram everything into the worksheet where it "logically" belongs — spread it out.

---

## Guidance for WS6: Lists & Indexing

Per ROADMAP.md, the agreed concepts are: creating lists, indexing (`list[0]`), negative indexing, `len()`, iterating with `for`, `append()`. Slicing is deferred to a later worksheet.

### What Students Already Know About Lists

Students have already USED lists in WS3 — they've written `for i in [1, 2, 3]:` and `for word in ['I', 'am', 'learning']:`. They just haven't been taught to think of these as "lists" they can create, store, name, and manipulate. This is a crucial starting point: **don't introduce lists as brand new.** Start from what they know.

### Suggested Sub-Concept Sequence

1. **Connection to WS3** — "Remember `[1, 2, 3]` from loops? That's a list! You can store it in a variable."
2. **Creating and printing lists** — assign a list to a variable, print it.
3. **Indexing with `[0]`** — access single items. Emphasise that Python counts from 0.
4. **Editing by index** — `my_list[0] = "new_value"`.
5. **Negative indexing** — `my_list[-1]` for the last item. Keep it to just -1 and -2.
6. **`len()`** — how many items? Connect to `range(len(my_list))`.
7. **Iterating with `for`** — `for item in my_list:` (they know this!) vs `for i in range(len(my_list)):` (new — index-based iteration).
8. **`append()`** — adding items to a list. Building a list in a loop.
9. **Combining with prior concepts** — lists + if (filtering), lists + f-strings (formatted output).
10. **Challenges** — e.g. find the biggest number, count occurrences, reverse a list.
11. **Creative challenge.**

### Scope Boundaries for WS6

- **IN scope:** `[]` literal, `list[i]`, `list[-1]`, `len()`, `for...in`, `range(len(...))`, `append()`, `list[i] = value`.
- **OUT of scope:** Slicing (`list[1:3]`), `remove()`, `pop()`, `sort()`, `insert()`, list comprehensions, nested lists, `in` keyword for membership testing.
- **On the fence:** `in` for membership (`if x in my_list`). This is very natural and useful, but it's a new keyword usage. Consider including it if the problem count allows, but don't prioritise it over solid practice with indexing and append.

### Key Pitfalls to Address

- **Off-by-one with indexing.** Students will try `my_list[3]` to get the 3rd item. Give this a bug-fix problem.
- **Confusion between the item and its index.** A concept card or trace showing both `for item in list` and `for i in range(len(list))` side by side would help.
- **`append()` modifies the list in place.** Students may try `new_list = my_list.append(x)` — a bug-fix problem for this is good.

---

## Checklist for Reviewing a New Worksheet

Before finalising a new worksheet, verify:

- [ ] Every new sub-concept follows the Run -> Edit -> Fix/Drill -> Write cycle (at minimum Run -> Write)
- [ ] No problem introduces more than one new concept simultaneously
- [ ] The first problem for each sub-concept has starter code (not blank)
- [ ] **Every new syntactic form has at least 1-2 Fix/Drill problems** (broken code to fix, missing syntax to add, or indentation to adjust) — placed BEFORE students write from scratch
- [ ] Students encounter the most common error messages for the new syntax in a controlled setting (via Fix/Drill problems) before they hit those errors on their own
- [ ] Concept cards appear BEFORE the problems they explain, not after
- [ ] "Reminder" problems exist for any prior-worksheet concept used in a new combination
- [ ] Problem count is 24-30 (excluding concept cards and traces)
- [ ] The worksheet ends with 1-2 challenge problems and a creative challenge
- [ ] Validation is tight for early problems, loose for challenges
- [ ] Word problems and fun contexts are sprinkled throughout (not just at the end)
- [ ] Maximum write-from-scratch code length grows by only ~2-3 lines from the previous worksheet
- [ ] The creative challenge has minimal validation (just "uses the construct" + "output not empty")
