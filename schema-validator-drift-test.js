// Meta-test: every validation rule type must be declared in both the JSON
// schema (worksheets/schema.json) and implemented in the validator switch
// (validation.js for non-AST rules, ast-validator.js for ast_* rules).
//
// This is the test that would have caught the original Cloudflare-blocking
// bug where ast_has_subscript_assign was implemented but never declared in
// the schema — `npm run validate:worksheets` rejected every worksheet that
// used it. See commit history around ast_has_subscript_assign.
//
// Run: node schema-validator-drift-test.js

const fs = require('fs');
const path = require('path');

// Collect all type.const values from the schema's rule oneOf.
function readSchemaRuleTypes() {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'worksheets', 'schema.json'), 'utf8'));
    const oneOf = schema?.definitions?.validationRule?.oneOf;
    if (!Array.isArray(oneOf)) {
        throw new Error('worksheets/schema.json: expected definitions.validationRule.oneOf to be an array');
    }
    const types = new Set();
    for (const variant of oneOf) {
        const constValue = variant?.properties?.type?.const;
        if (typeof constValue === 'string') {
            types.add(constValue);
        }
    }
    return types;
}

// Collect all `case 'X':` rule names from a validator source file.
// Only counts the rule-dispatching switch — we look at every `case 'X':`
// at the top level of the file; both validation.js and ast-validator.js
// have exactly one such switch each.
function readImplementedRuleTypes(file) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const types = new Set();
    const re = /case\s+['"]([a-z_][a-z0-9_]*)['"]\s*:/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        types.add(m[1]);
    }
    return types;
}

function diff(setA, setB) {
    const onlyInA = [];
    for (const v of setA) {
        if (!setB.has(v)) {
            onlyInA.push(v);
        }
    }
    return onlyInA.sort();
}

const schemaTypes = readSchemaRuleTypes();
const validationTypes = readImplementedRuleTypes('validation.js');
const astValidatorTypes = readImplementedRuleTypes('ast-validator.js');
const implementedTypes = new Set([...validationTypes, ...astValidatorTypes]);

const declaredButUnimplemented = diff(schemaTypes, implementedTypes);
const implementedButUndeclared = diff(implementedTypes, schemaTypes);

let failed = false;

console.log('🧪 schema-validator-drift-test');
console.log(`   schema rule types:       ${schemaTypes.size}`);
console.log(`   validation.js cases:     ${validationTypes.size}`);
console.log(`   ast-validator.js cases:  ${astValidatorTypes.size}`);
console.log('');

if (declaredButUnimplemented.length > 0) {
    console.error('❌ Rule types declared in worksheets/schema.json but not implemented:');
    for (const t of declaredButUnimplemented) {
        console.error(`     - ${t}`);
    }
    console.error('   Fix: add a case for each in validation.js or ast-validator.js,');
    console.error('        or remove from schema.json and worksheets/README.md.');
    console.error('');
    failed = true;
}

if (implementedButUndeclared.length > 0) {
    console.error('❌ Rule types implemented but not declared in worksheets/schema.json:');
    for (const t of implementedButUndeclared) {
        console.error(`     - ${t}`);
    }
    console.error('   Fix: add a oneOf entry for each in worksheets/schema.json.');
    console.error('        npm run validate:worksheets will reject any worksheet that uses');
    console.error('        an undeclared rule, breaking Cloudflare deploys on that branch.');
    console.error('');
    failed = true;
}

if (failed) {
    process.exit(1);
}

console.log('✅ Schema and validator implementations are in sync.');
