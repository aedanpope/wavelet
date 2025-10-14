# TASK 6: Code Quality Improvements - TypeScript Migration Analysis

## Problem Statement

As the Wavelet codebase grows (~4,400 lines of JavaScript), we need to assess whether migrating to TypeScript would improve code quality, maintainability, and developer experience, or whether alternative approaches would better serve the project's needs.

## Context Analysis

### Current Codebase State

**Size & Structure:**
- ~4,400 lines of custom JavaScript code (excluding node_modules)
- 13 core modules: script.js, worksheet.js, validation.js, input-system.js, error-handler.js, code-executor.js, validate-solution-code.js, plus comprehensive test files
- Static site deployment with no build pipeline (direct HTML/JS to GitHub Pages)
- Browser-first architecture with CDN dependencies (Pyodide, CodeMirror, MathJax)

**Project Context:**
- Educational platform for 11-year-old students learning Python
- Active worksheet development (WS1-5 complete, more planned)
- Solo/small team development
- WSL2/Windows environment
- Comprehensive test coverage already in place

**Deployment Model:**
- Current: `npm run build` → generate version.js → push to GitHub Pages
- No bundling, no transpilation, no build complexity
- Instant deployment, immediate results

## TypeScript Migration Assessment

### Arguments FOR TypeScript

1. **Type Safety in Complex Validation Logic**
   - Complex validation rules in validation.js would benefit from type checking
   - Worksheet JSON structure could have typed interfaces
   - Could catch missing properties in problem definitions at compile time
   - Example: `validateRule()` function has multiple rule types with different shapes

2. **Better IDE Support**
   - IntelliSense for Pyodide API (currently untyped external library)
   - Autocomplete for CodeMirror configuration
   - More reliable refactoring with type-aware tools
   - Jump-to-definition would work better across modules

3. **Self-Documenting Code**
   - Types serve as inline documentation
   - Easier for future contributors to understand structure
   - Clear contracts between modules
   - Worksheet schema would be explicit and enforced

4. **Catch Errors Earlier**
   - Typos in property names caught at compile time
   - Function signature mismatches would be obvious
   - Invalid enum values detected immediately
   - Prevents runtime errors from type confusion

5. **Future Scalability**
   - If project grows beyond current 4.4k lines
   - If more contributors join the project
   - If more complex features are added (WS6-10)
   - If external API integrations are needed

### Arguments AGAINST TypeScript

1. **Educational Context - Stability is Critical**
   - Platform serves primary school children in active learning
   - Any migration bugs directly impact students' education
   - Current system works reliably - proven in production
   - Risk of introducing regressions during migration is high
   - "First, do no harm" principle applies

2. **Deployment Simplicity Would Be Lost**
   - Current: Push to GitHub Pages → instant deployment
   - With TS: Need build pipeline, compilation, source maps, bundler
   - `npm run build` would become complex build process
   - Debugging requires source maps and understanding transpilation
   - Increases deployment surface area for errors

3. **Project Scale Doesn't Justify Complexity**
   - 4.4k lines is relatively small
   - Solo/small team reduces coordination benefits of types
   - Comprehensive test suite already catches issues
   - TypeScript overhead (tsconfig, type definitions, build tools) is significant

4. **Browser-First Architecture Conflict**
   - Code designed to run directly in browser without bundling
   - TS requires compilation and module bundling (webpack/vite/esbuild)
   - Would need to restructure entire module system
   - Current simplicity (script tags) would be lost

5. **Development Velocity Impact**
   - Actively iterating on worksheet design
   - TS compilation slows edit-refresh cycle
   - Type errors can block rapid prototyping
   - Educational content development should be fast and fluid
   - WSL2 environment adds compilation overhead

6. **Testing Already Provides Safety Net**
   - Comprehensive test files: error-handler-test.js, validation-test.js, input-system-test.js, validate-solution-code-test.js
   - Tests catch the same classes of bugs TypeScript would
   - Current approach is working effectively
   - No evidence of type-related bugs in production

### Risk/Benefit Analysis

**Migration Risks:**
- **HIGH**: Introducing bugs during migration that affect students
- **HIGH**: Deployment pipeline complexity increases
- **MEDIUM**: Development velocity slowdown during active worksheet development
- **MEDIUM**: Build tooling maintenance overhead
- **LOW**: Performance impact (negligible for this use case)

**Migration Benefits:**
- **LOW**: Catching bugs (tests already do this)
- **LOW**: Code documentation (JSDoc can provide this)
- **LOW**: Refactoring safety (small codebase, infrequent large refactors)
- **MEDIUM**: IDE experience improvements
- **HIGH**: Future-proofing (only valuable if project grows significantly)

**Risk/Benefit Conclusion:**
The risks outweigh the benefits given the project's current state, educational context, and development phase.

## Recommendation: DO NOT Migrate to TypeScript

### Primary Rationales

1. **Stability for Students**: The platform is actively serving students. Migration introduces unnecessary risk of bugs that directly impact education.

2. **Deployment Elegance**: The current static deployment model is elegant, reliable, and fast. TypeScript would complicate this significantly without proportional benefit.

3. **Development Phase**: Currently in active worksheet development phase. Type system overhead would slow creative iteration.

4. **Scale Appropriate**: 4.4k lines with good test coverage doesn't justify TypeScript's complexity overhead.

5. **Working System**: "If it ain't broke, don't fix it" - no evidence of type-related production issues.

## Alternative Improvement Plan

Instead of TypeScript, implement these targeted improvements that provide type safety benefits without migration overhead:

### 1. JSDoc Type Annotations

Add type hints to existing JavaScript without migration or build step changes.

**Benefits:**
- Type checking via VS Code's built-in TypeScript engine
- Zero build step changes
- Gradual adoption - add types where most valuable
- Better IDE autocomplete and IntelliSense
- Self-documenting code

**Implementation Approach:**

```javascript
/**
 * @typedef {Object} Problem
 * @property {string} id - Unique problem identifier
 * @property {string} title - Problem title
 * @property {string} task - Task description
 * @property {string} difficulty - "easy" | "medium" | "hard"
 * @property {ValidationRules} validation - Validation configuration
 * @property {InputConfig[]} [inputs] - Optional input configurations
 * @property {string} [starterCode] - Optional starter code
 * @property {string} [solutionCode] - Optional solution code
 */

/**
 * @typedef {Object} ValidationRules
 * @property {ValidationRule[]} rules - Array of validation rules
 * @property {string} [successMessage] - Custom success message
 */

/**
 * @typedef {Object} ValidationRule
 * @property {'code_contains' | 'output_contains' | 'code_not_contains' | 'solution_code'} type
 * @property {string} [pattern] - Pattern to match (for code/output rules)
 * @property {string} [message] - Error message if validation fails
 */

/**
 * Validates student's answer using validation rules from problem definition
 * @param {string} code - The student's code
 * @param {string} output - The program output
 * @param {Problem} problem - Problem configuration object
 * @param {number} problemIndex - Index of the problem in worksheet
 * @param {Object} codeExecutor - Code execution context
 * @returns {Promise<{isValid: boolean, errorType: string|null, message: string}>}
 */
async function validateAnswer(code, output, problem, problemIndex, codeExecutor) {
    // Implementation...
}

/**
 * Validates a single validation rule
 * @param {string} code - Student's code
 * @param {string} output - Program output
 * @param {ValidationRule} rule - Validation rule to check
 * @param {Problem} problem - Problem configuration
 * @param {number} problemIndex - Problem index
 * @param {Object} codeExecutor - Code execution context
 * @returns {Promise<boolean|{isValid: false, errorType: string, message: string}>}
 */
async function validateRule(code, output, rule, problem, problemIndex, codeExecutor) {
    // Implementation...
}

/**
 * Loads worksheet data from JSON file
 * @param {string} worksheetId - Worksheet identifier (e.g., "worksheet-1")
 * @returns {Promise<{id: string, title: string, description: string, problems: Problem[]}>}
 * @throws {Error} If worksheet cannot be loaded
 */
async function loadWorksheet(worksheetId) {
    // Implementation...
}

/**
 * Saves student progress to localStorage
 * @param {string} worksheetId - Worksheet identifier
 * @returns {void}
 */
function saveProgress(worksheetId) {
    // Implementation...
}

/**
 * Input configuration for interactive problems
 * @typedef {Object} InputConfig
 * @property {string} name - Input field name (used in get_input())
 * @property {string} label - Display label for the input
 * @property {'number' | 'text'} type - Input type
 * @property {string} [placeholder] - Optional placeholder text
 * @property {number|string} [defaultValue] - Optional default value
 */
```

**Priority Files for JSDoc:**
1. **validation.js** - Most complex logic, highest benefit from types
2. **worksheet.js** - Core functionality, many function interactions
3. **input-system.js** - Clear input/output contracts
4. **code-executor.js** - Integration with Pyodide API
5. **error-handler.js** - Error type definitions

**VS Code Configuration:**
Add to `.vscode/settings.json`:
```json
{
  "js/ts.implicitProjectConfig.checkJs": true,
  "javascript.validate.enable": true
}
```

This enables type checking for JS files with JSDoc annotations.

### 2. JSON Schema for Worksheet Validation

Validate worksheet structure to catch malformed definitions before they reach students.

**Benefits:**
- Catches missing required fields
- Validates problem structure
- Ensures validation rules are correctly formed
- Prevents deployment of broken worksheets
- Self-documenting worksheet format

**Implementation Approach:**

Create `worksheets/schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Wavelet Worksheet Schema",
  "type": "object",
  "required": ["id", "title", "description", "problems"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^worksheet-[0-9]+$",
      "description": "Unique worksheet identifier"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "Worksheet title"
    },
    "description": {
      "type": "string",
      "minLength": 1,
      "description": "Worksheet description"
    },
    "problems": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/definitions/problem"
      }
    }
  },
  "definitions": {
    "problem": {
      "type": "object",
      "required": ["id", "title", "task", "difficulty"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z0-9-_]+$"
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "task": {
          "type": "string",
          "minLength": 1
        },
        "difficulty": {
          "type": "string",
          "enum": ["easy", "medium", "hard"]
        },
        "content": {
          "type": "string",
          "description": "Optional instructional content"
        },
        "starterCode": {
          "type": "string",
          "description": "Optional starter code"
        },
        "solutionCode": {
          "type": "string",
          "description": "Optional solution code"
        },
        "inputs": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/input"
          }
        },
        "validation": {
          "$ref": "#/definitions/validation"
        }
      }
    },
    "input": {
      "type": "object",
      "required": ["name", "label", "type"],
      "properties": {
        "name": {
          "type": "string",
          "pattern": "^[a-z_][a-z0-9_]*$"
        },
        "label": {
          "type": "string",
          "minLength": 1
        },
        "type": {
          "type": "string",
          "enum": ["number", "text"]
        },
        "placeholder": {
          "type": "string"
        },
        "defaultValue": {
          "oneOf": [
            {"type": "number"},
            {"type": "string"}
          ]
        }
      }
    },
    "validation": {
      "type": "object",
      "required": ["rules"],
      "properties": {
        "rules": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/definitions/validationRule"
          }
        },
        "successMessage": {
          "type": "string"
        }
      }
    },
    "validationRule": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["code_contains", "output_contains", "code_not_contains", "solution_code"]
        },
        "pattern": {
          "type": "string"
        },
        "message": {
          "type": "string"
        }
      }
    }
  }
}
```

**Validation Script:**

Create `scripts/validate-worksheets.js`:

```javascript
const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const ajv = new Ajv({ allErrors: true });
const schema = JSON.parse(fs.readFileSync('worksheets/schema.json', 'utf8'));
const validate = ajv.compile(schema);

// Load worksheet index
const indexPath = 'worksheets/index.json';
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

let hasErrors = false;

// Validate each worksheet
for (const worksheet of index.worksheets) {
    const worksheetPath = `worksheets/${worksheet.id}.json`;

    try {
        const worksheetData = JSON.parse(fs.readFileSync(worksheetPath, 'utf8'));
        const valid = validate(worksheetData);

        if (!valid) {
            console.error(`❌ Validation failed for ${worksheet.id}:`);
            console.error(JSON.stringify(validate.errors, null, 2));
            hasErrors = true;
        } else {
            console.log(`✅ ${worksheet.id} is valid`);
        }
    } catch (error) {
        console.error(`❌ Error loading ${worksheetPath}:`, error.message);
        hasErrors = true;
    }
}

if (hasErrors) {
    console.error('\n❌ Worksheet validation failed');
    process.exit(1);
} else {
    console.log('\n✅ All worksheets are valid');
}
```

**Package.json Integration:**

```json
{
  "scripts": {
    "validate:worksheets": "node scripts/validate-worksheets.js",
    "prebuild": "npm run validate:worksheets && node scripts/generate-version.js",
    "test:all": "npm run validate:worksheets && for f in *-test.js; do echo \"\\n🧪 Running $f...\"; node \"$f\" || exit 1; done"
  },
  "devDependencies": {
    "ajv": "^8.12.0"
  }
}
```

This ensures worksheets are validated before every build and test run.

### 3. ESLint Configuration

Catch common JavaScript errors and enforce consistent code style.

**Benefits:**
- Catches undefined variables
- Detects unused variables and functions
- Enforces consistent code style
- Prevents common JavaScript pitfalls
- Integrates with VS Code for real-time feedback

**Implementation Approach:**

Install ESLint:
```bash
npm install --save-dev eslint
```

Create `.eslintrc.json`:

```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2021,
    "sourceType": "script"
  },
  "globals": {
    "pyodide": "readonly",
    "CodeMirror": "readonly",
    "MathJax": "readonly",
    "loadPyodide": "readonly"
  },
  "rules": {
    "no-unused-vars": ["warn", {
      "vars": "all",
      "args": "after-used",
      "argsIgnorePattern": "^_"
    }],
    "no-undef": "error",
    "no-console": "off",
    "prefer-const": "warn",
    "no-var": "warn",
    "eqeqeq": ["warn", "always"],
    "curly": ["warn", "all"],
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-throw-literal": "error"
  },
  "ignorePatterns": [
    "node_modules/",
    "version.js",
    "*-test.js"
  ]
}
```

**Package.json Scripts:**

```json
{
  "scripts": {
    "lint": "eslint *.js",
    "lint:fix": "eslint *.js --fix",
    "pretest": "npm run lint"
  }
}
```

**VS Code Integration:**

Add to `.vscode/settings.json`:
```json
{
  "eslint.enable": true,
  "eslint.validate": ["javascript"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

**Priority Fixes:**
1. Review existing code for undefined variables
2. Remove unused variables and functions
3. Convert `var` to `const`/`let`
4. Add strict equality (`===`) where appropriate

### 4. ES6 Module Organization (Optional)

Modernize code organization without TypeScript complexity.

**Benefits:**
- Explicit imports/exports clarify dependencies
- Better tree-shaking potential
- Standard modern JavaScript approach
- Easier to understand module relationships
- Prepares codebase for future bundler if needed

**Implementation Approach:**

This is the most invasive change and should be considered carefully. It requires:

1. **Convert to ES6 Modules:**

```javascript
// validation.js
export async function validateAnswer(code, output, problem, problemIndex, codeExecutor) {
    // Implementation...
}

export async function validateRule(code, output, rule, problem, problemIndex, codeExecutor) {
    // Implementation...
}
```

```javascript
// worksheet.js
import { validateAnswer } from './validation.js';
import { ErrorHandler } from './error-handler.js';
import { InputSystem } from './input-system.js';

// Use imported functions...
```

2. **Update HTML script tags:**

```html
<script type="module" src="validation.js"></script>
<script type="module" src="worksheet.js"></script>
```

3. **Consider bundler for production:**
   - Development: Native ES6 modules (works in modern browsers)
   - Production: Optional bundler (Vite, esbuild) for optimization

**Decision Point:**
This change is more invasive and should only be pursued if:
- The team is comfortable with module bundlers
- There's a clear benefit to module organization
- You're willing to add build complexity

**Recommendation:** Defer this until other improvements are complete and proven valuable.

## Implementation Priority & Phasing

### Phase 1: Low-Risk, High-Value Improvements ✅ COMPLETED

**Priority 1A: JSON Schema Validation** ✅
- **Effort:** 2-3 hours
- **Risk:** Very low (doesn't touch production code)
- **Value:** Immediate - prevents malformed worksheets
- **Impact:** Quality assurance for worksheet creation
- **Status:** ✅ Complete - All 5 worksheets validate successfully
- **Files:** `worksheets/schema.json`, `scripts/validate-worksheets.js`, `worksheets/README.md`
- **Integration:** Runs in `prebuild` and `test:all`

**Priority 1B: ESLint Basic Setup** ✅
- **Effort:** 1-2 hours
- **Risk:** Very low (doesn't change code, only warns)
- **Value:** Immediate feedback on common errors
- **Impact:** Catches undefined variables, unused code
- **Status:** ✅ Complete - 47 issues identified (29 errors, 18 warnings)
- **Files:** `eslint.config.js`, `ESLINT_FINDINGS.md`
- **Integration:** Runs in `test:all` (errors only, warnings allowed)

### ESLint Build Integration Plan

**Current State:**
- ✅ ESLint runs in `test:all` with `lint:errors` (blocks on errors, allows warnings)
- ⏳ ESLint does NOT run in `prebuild` yet

**Rationale for Gradual Integration:**
1. **Current errors exist** - 29 errors would block builds immediately
2. **Educational priority** - Must not block urgent hotfixes for students
3. **Test-first approach** - Catch issues during development, not deployment

**Integration Timeline:**

**Phase 1B-1: Test Suite Integration** ✅ DONE
- Add `npm run lint:errors` to `test:all`
- Blocks on errors, allows warnings
- Encourages fixing issues during development
- Doesn't block emergency deployments

**Phase 1B-2: Fix Critical Errors** ⏳ NEXT
- Fix undefined variables (validate-solution-code.js)
- Fix const assignment (validate-solution-code.js)
- Fix case block declarations (validation.js, validate-solution-code.js)
- **Goal:** Get to zero errors

**Phase 1B-3: Build Integration** 🔜 FUTURE
- Once errors are fixed, add to `prebuild`:
  ```json
  {
    "prebuild": "npm run validate:worksheets && npm run lint:errors && node scripts/generate-version.js"
  }
  ```
- This will block deployment of code with linting errors
- Warnings will still be allowed

**Phase 1B-4: Strict Mode** 🔮 OPTIONAL
- After team is comfortable, consider blocking on warnings too:
  ```json
  {
    "lint:strict": "eslint *.js",
    "prebuild": "npm run validate:worksheets && npm run lint:strict && node scripts/generate-version.js"
  }
  ```
- Only do this when all warnings are addressed

**Decision Point:**
After Phase 1B-2 (critical errors fixed), evaluate:
- Has ESLint caught real bugs?
- Is the team comfortable with the workflow?
- Should we add to `prebuild` or keep in `test:all` only?

### Phase 2: Documentation & Type Hints

**Priority 2A: JSDoc for Core Modules**
- **Effort:** 4-6 hours (spread across modules)
- **Risk:** Very low (comments only, no behavioral changes)
- **Value:** Progressive - improves as more annotations added
- **Impact:** Better IDE experience, self-documenting code
- **Order:** validation.js → worksheet.js → input-system.js → others

### Phase 3: Optional Advanced Improvements

**Priority 3A: ES6 Modules (Deferred)**
- **Effort:** 8-12 hours
- **Risk:** Medium (requires testing all functionality)
- **Value:** Moderate - cleaner architecture
- **Impact:** Better code organization, modern approach
- **Decision:** Evaluate after Phase 1 & 2 complete

## Success Criteria

### Phase 1 Success Metrics
- ✅ All worksheets pass JSON schema validation
- ✅ ESLint runs without errors on core files
- ✅ Validation script integrated into build process
- ✅ No regression in functionality

### Phase 2 Success Metrics
- ✅ Core modules have comprehensive JSDoc annotations
- ✅ VS Code provides accurate autocomplete for validation functions
- ✅ Type errors caught during development (via VS Code)
- ✅ Documentation generated from JSDoc comments

### Overall Success Criteria
- ✅ Code quality improvements without migration overhead
- ✅ No disruption to active worksheet development
- ✅ No changes to deployment process
- ✅ Better developer experience without build complexity
- ✅ Maintained stability for students

## Files to Create/Modify

### New Files to Create:
1. `worksheets/schema.json` - JSON schema for worksheet validation
2. `scripts/validate-worksheets.js` - Validation script
3. `.eslintrc.json` - ESLint configuration
4. `.vscode/settings.json` - VS Code configuration (if doesn't exist)

### Files to Modify:
1. `package.json` - Add validation scripts, ESLint scripts, dependencies
2. `validation.js` - Add JSDoc type annotations
3. `worksheet.js` - Add JSDoc type annotations
4. `input-system.js` - Add JSDoc type annotations
5. `code-executor.js` - Add JSDoc type annotations
6. `error-handler.js` - Add JSDoc type annotations
7. `.gitignore` - Ensure node_modules covered

### Files NOT to Modify:
- HTML files (no changes needed for Phase 1 & 2)
- Test files (keep as-is initially)
- CSS files (no impact)
- Worksheet JSON files (validated, not modified)

## Potential Risks & Mitigation

**Risk: JSON Schema too strict, blocks valid worksheets**
- **Mitigation:** Start permissive, tighten based on actual usage
- **Testing:** Run validation against all existing worksheets first

**Risk: ESLint flags too many warnings, overwhelming**
- **Mitigation:** Start with "warn" level, address incrementally
- **Approach:** Fix critical errors first, then address warnings

**Risk: JSDoc annotations are incorrect, misleading**
- **Mitigation:** Validate annotations against actual usage
- **Testing:** Let VS Code's TypeScript engine catch inconsistencies

**Risk: Time investment doesn't yield practical benefits**
- **Mitigation:** Phased approach - stop if Phase 1 doesn't add value
- **Assessment:** Evaluate after each phase before proceeding

## Why This Approach is Better Than TypeScript

1. **Zero Migration Risk:** No code changes required, only additions
2. **Incremental Adoption:** Can add types gradually where most valuable
3. **No Build Complexity:** Existing deployment pipeline unchanged
4. **Fast Iteration:** No compilation step slows development
5. **Standard JavaScript:** No lock-in to TypeScript ecosystem
6. **Learning Curve:** Team already knows JavaScript, minimal new concepts
7. **Educational Focus:** Maintains stability for student-facing platform
8. **Appropriate Scale:** Right-sized solution for 4.4k line codebase

## Next Steps

1. **Immediate:** Create this task document ✅
2. **Short-term:** Implement Phase 1 (JSON Schema + ESLint)
3. **Medium-term:** Add JSDoc annotations to core modules (Phase 2)
4. **Long-term:** Reassess after WS6-10 development whether ES6 modules worth pursuing

## Conclusion

TypeScript migration is **not recommended** for Wavelet at this stage. The project's educational context, current scale, active development phase, and static deployment model make the migration risks outweigh potential benefits.

Instead, a phased approach using **JSDoc annotations, JSON Schema validation, and ESLint** provides most of TypeScript's benefits without the migration overhead, build complexity, or risk to the student-facing platform.

This approach is appropriate for the project's current state and can be reevaluated if the codebase grows significantly or the team structure changes.

---

## Revision Notes

**Created:** 2025-10-14

**Context:** Comprehensive analysis of TypeScript migration decision for Wavelet platform. Decision based on project scale (~4.4k lines), educational context (serving 11-year-olds), active worksheet development phase, static deployment model, and risk/benefit assessment.

**Key Decision:** Pursue alternative improvements (JSDoc, JSON Schema, ESLint) instead of TypeScript migration. These provide type safety benefits without migration overhead or deployment complexity.

**Implementation Priority:** Phase 1 (JSON Schema + ESLint) → Phase 2 (JSDoc) → Reassess ES6 modules later.
