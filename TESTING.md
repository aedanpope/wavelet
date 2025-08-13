# Testing Guide

This project includes comprehensive tests to ensure the homepage and application work correctly.

## Test Types

### 1. Basic Homepage Tests (`test-homepage-basic.js`)
**No external dependencies required**

These tests check the basic structure and files without requiring a browser:
- ✅ Required files exist
- ✅ HTML structure is correct
- ✅ Worksheets index structure is valid
- ✅ Individual worksheets have proper structure
- ✅ Time estimates have been removed
- ✅ CSS file is valid
- ✅ JavaScript file is valid

**Run with:**
```bash
npm run test:homepage:basic
# or
node test-homepage-basic.js
```

### 2. Error Handling Tests (`test-error-handling.js`)
**No external dependencies required**

Tests the error message extraction functionality:
- ✅ NameError handling
- ✅ SyntaxError handling
- ✅ IndentationError handling
- ✅ TypeError handling
- ✅ ZeroDivisionError handling
- ✅ Custom error messages

**Run with:**
```bash
npm run test
# or
node test-error-handling.js
```



## Running All Tests

To run all tests (basic + error handling):
```bash
npm run test:all
```

## Test Results

All tests provide detailed output showing:
- ✅ Passed tests
- ❌ Failed tests with error details
- 📊 Summary statistics
- 📈 Success rate percentage

## Continuous Integration

These tests can be easily integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm run test:all
```

## Troubleshooting

### PowerShell Execution Policy Issues
If you get "running scripts is disabled" errors on Windows:
1. The `.npmrc` file is configured to bypass execution policy
2. If issues persist, run individual tests: `node test-error-handling.js` and `node test-homepage-basic.js`
3. Or use: `powershell -ExecutionPolicy Bypass -Command "npm run test:all"`



### File Structure Issues
If basic tests fail:
1. Ensure all required files exist
2. Check file permissions
3. Verify JSON syntax in worksheet files

### Network Issues
If tests fail to load external resources:
1. Check internet connection
2. Verify CDN resources are accessible
3. Consider using local fallbacks
