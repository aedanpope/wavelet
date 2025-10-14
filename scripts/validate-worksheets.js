/**
 * Worksheet Validation Script
 *
 * Validates all worksheets against the JSON schema to ensure:
 * - Required fields are present
 * - Validation rules are correctly structured
 * - Input configurations are valid
 * - Problem definitions follow the expected format
 *
 * Usage: node scripts/validate-worksheets.js
 */

const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(message, 'red');
}

function logSuccess(message) {
  log(message, 'green');
}

function logWarning(message) {
  log(message, 'yellow');
}

function logInfo(message) {
  log(message, 'cyan');
}

// Initialize AJV with options
const ajv = new Ajv({
  allErrors: true,
  verbose: true
});

// Load the schema
const schemaPath = path.join(__dirname, '../worksheets/schema.json');
let schema;
try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  logInfo('✓ Schema loaded successfully');
} catch (error) {
  logError(`❌ Failed to load schema from ${schemaPath}`);
  logError(error.message);
  process.exit(1);
}

const validate = ajv.compile(schema);

// Load worksheet index
const indexPath = path.join(__dirname, '../worksheets/index.json');
let index;
try {
  index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  logInfo(`✓ Found ${index.worksheets.length} worksheets in index\n`);
} catch (error) {
  logError(`❌ Failed to load worksheet index from ${indexPath}`);
  logError(error.message);
  process.exit(1);
}

let hasErrors = false;
let validCount = 0;
let errorCount = 0;

// Validate each worksheet
for (const worksheetEntry of index.worksheets) {
  const worksheetPath = path.join(__dirname, '../worksheets', `${worksheetEntry.id}.json`);

  try {
    const worksheetData = JSON.parse(fs.readFileSync(worksheetPath, 'utf8'));
    const valid = validate(worksheetData);

    if (!valid) {
      errorCount++;
      hasErrors = true;
      logError(`\n❌ Validation failed for ${worksheetEntry.id}:`);
      logError(`   File: ${worksheetPath}\n`);

      // Display validation errors in a readable format
      validate.errors.forEach((error, index) => {
        logError(`   Error ${index + 1}:`);
        logError(`     Path: ${error.instancePath || '(root)'}`);
        logError(`     Message: ${error.message}`);

        if (error.params) {
          const params = Object.entries(error.params)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join(', ');
          logError(`     Details: ${params}`);
        }

        console.log(); // Empty line between errors
      });
    } else {
      validCount++;

      // Additional checks not covered by schema
      const warnings = [];

      // Check for problems without validation rules
      worksheetData.problems.forEach((problem, idx) => {
        if (!problem.validation || !problem.validation.rules || problem.validation.rules.length === 0) {
          warnings.push(`Problem ${idx + 1} ("${problem.title}") has no validation rules`);
        }
      });

      // Check for inputs without corresponding get_input() usage
      worksheetData.problems.forEach((problem, idx) => {
        if (problem.inputs && problem.inputs.length > 0 && problem.starterCode) {
          const hasGetInput = /get_input\s*\(/.test(problem.starterCode);
          if (!hasGetInput) {
            warnings.push(`Problem ${idx + 1} ("${problem.title}") has inputs but starter code doesn't use get_input()`);
          }
        }
      });

      if (warnings.length > 0) {
        logSuccess(`✅ ${worksheetEntry.id} is valid (with warnings)`);
        warnings.forEach(warning => logWarning(`   ⚠ ${warning}`));
      } else {
        logSuccess(`✅ ${worksheetEntry.id} is valid`);
      }
    }
  } catch (error) {
    errorCount++;
    hasErrors = true;
    logError(`\n❌ Error loading ${worksheetEntry.id}:`);
    logError(`   File: ${worksheetPath}`);
    logError(`   ${error.message}\n`);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
log(`\n${colors.bold}Validation Summary:${colors.reset}`);
logSuccess(`  ✓ Valid worksheets: ${validCount}`);
if (errorCount > 0) {
  logError(`  ✗ Invalid worksheets: ${errorCount}`);
}
console.log('='.repeat(60) + '\n');

if (hasErrors) {
  logError('❌ Worksheet validation failed');
  logError('Please fix the errors above before deploying.\n');
  process.exit(1);
} else {
  logSuccess('✅ All worksheets are valid!');
  logSuccess('Ready for deployment.\n');
  process.exit(0);
}
