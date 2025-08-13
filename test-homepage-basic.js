// Basic homepage test - no external dependencies
// Run with: node test-homepage-basic.js

const fs = require('fs');
const path = require('path');

class BasicHomepageTest {
    constructor() {
        this.testResults = [];
    }

    runTest(testName, testFunction) {
        console.log(`\n🧪 Running: ${testName}`);
        try {
            const result = testFunction();
            this.testResults.push({ name: testName, status: 'PASSED', result });
            console.log(`✅ ${testName}: PASSED`);
            return result;
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
            console.log(`❌ ${testName}: FAILED - ${error.message}`);
            throw error;
        }
    }

    testRequiredFilesExist() {
        const requiredFiles = [
            'index.html',
            'styles.css',
            'script.js',
            'error-handler.js',
            'worksheets/index.json',
            'worksheets/worksheet-1.json',
            'worksheets/worksheet-2.json',
            'worksheets/worksheet-3.json',
            'worksheets/template.json'
        ];

        const missingFiles = [];
        
        requiredFiles.forEach(file => {
            if (!fs.existsSync(file)) {
                missingFiles.push(file);
            }
        });

        if (missingFiles.length > 0) {
            throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
        }

        return { filesFound: requiredFiles.length };
    }

    testHTMLStructure() {
        const htmlContent = fs.readFileSync('index.html', 'utf8');
        
        // Check for required HTML elements
        const requiredElements = [
            '<title>',
            'id="worksheet-selection"',
            'id="worksheet-interface"',
            'id="worksheets-grid"',
            'id="code-editor"',
            'script src="script.js"'
        ];

        const missingElements = [];
        
        requiredElements.forEach(element => {
            if (!htmlContent.includes(element)) {
                missingElements.push(element);
            }
        });

        if (missingElements.length > 0) {
            throw new Error(`Missing required HTML elements: ${missingElements.join(', ')}`);
        }

        return { elementsFound: requiredElements.length };
    }

    testWorksheetsIndexStructure() {
        const indexContent = fs.readFileSync('worksheets/index.json', 'utf8');
        const indexData = JSON.parse(indexContent);

        // Check if index has required structure
        if (!indexData.worksheets || !Array.isArray(indexData.worksheets)) {
            throw new Error('Worksheets index missing "worksheets" array');
        }

        if (indexData.worksheets.length < 3) {
            throw new Error(`Expected at least 3 worksheets, found ${indexData.worksheets.length}`);
        }

        // Check each worksheet has required fields
        const requiredFields = ['id', 'title', 'description', 'difficulty', 'file'];
        
        indexData.worksheets.forEach((worksheet, index) => {
            requiredFields.forEach(field => {
                if (!worksheet[field]) {
                    throw new Error(`Worksheet ${index + 1} missing required field: ${field}`);
                }
            });
        });

        return { worksheetCount: indexData.worksheets.length };
    }

    testIndividualWorksheets() {
        const worksheetFiles = [
            'worksheets/worksheet-1.json',
            'worksheets/worksheet-2.json',
            'worksheets/worksheet-3.json'
        ];

        const requiredWorksheetFields = ['id', 'title', 'description', 'difficulty', 'problems'];
        const requiredProblemFields = ['id', 'type', 'title', 'content', 'task', 'starterCode', 'expectedOutput', 'hint', 'points'];

        worksheetFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            const data = JSON.parse(content);

            // Check worksheet structure
            requiredWorksheetFields.forEach(field => {
                if (!data[field]) {
                    throw new Error(`${file} missing required field: ${field}`);
                }
            });

            // Check problems structure
            if (!Array.isArray(data.problems) || data.problems.length === 0) {
                throw new Error(`${file} has no problems or problems is not an array`);
            }

            data.problems.forEach((problem, index) => {
                requiredProblemFields.forEach(field => {
                    if (!problem[field]) {
                        throw new Error(`${file} problem ${index + 1} missing required field: ${field}`);
                    }
                });
            });
        });

        return { worksheetsValidated: worksheetFiles.length };
    }

    testNoTimeEstimates() {
        const filesToCheck = [
            'worksheets/index.json',
            'worksheets/worksheet-1.json',
            'worksheets/worksheet-2.json',
            'worksheets/worksheet-3.json',
            'worksheets/template.json'
        ];

        const filesWithTimeEstimates = [];

        filesToCheck.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes('estimatedTime')) {
                filesWithTimeEstimates.push(file);
            }
        });

        if (filesWithTimeEstimates.length > 0) {
            throw new Error(`Files still contain time estimates: ${filesWithTimeEstimates.join(', ')}`);
        }

        return { timeEstimatesRemoved: true };
    }

    testCSSFile() {
        const cssContent = fs.readFileSync('styles.css', 'utf8');
        
        // Check for basic CSS structure
        if (cssContent.length < 100) {
            throw new Error('CSS file seems too small, may be empty or corrupted');
        }

        // Check for some expected CSS classes
        const expectedClasses = [
            '.container',
            '.worksheet-selection',
            '.worksheet-interface',
            '.worksheet-card'
        ];

        const missingClasses = [];
        
        expectedClasses.forEach(className => {
            if (!cssContent.includes(className)) {
                missingClasses.push(className);
            }
        });

        if (missingClasses.length > 0) {
            throw new Error(`Missing expected CSS classes: ${missingClasses.join(', ')}`);
        }

        return { cssValid: true };
    }

    testJavaScriptFile() {
        const jsContent = fs.readFileSync('script.js', 'utf8');
        
        // Check for basic JavaScript structure
        if (jsContent.length < 100) {
            throw new Error('JavaScript file seems too small, may be empty or corrupted');
        }

        // Check for some expected functions or patterns
        const expectedPatterns = [
            'addEventListener',
            'getElementById',
            'fetch',
            '.json()'
        ];

        const missingPatterns = [];
        
        expectedPatterns.forEach(pattern => {
            if (!jsContent.includes(pattern)) {
                missingPatterns.push(pattern);
            }
        });

        if (missingPatterns.length > 0) {
            throw new Error(`Missing expected JavaScript patterns: ${missingPatterns.join(', ')}`);
        }

        return { jsValid: true };
    }

    runAllTests() {
        console.log('🧪 Starting Basic Homepage Tests\n');
        
        try {
            this.runTest('Required Files Exist', () => this.testRequiredFilesExist());
            this.runTest('HTML Structure', () => this.testHTMLStructure());
            this.runTest('Worksheets Index Structure', () => this.testWorksheetsIndexStructure());
            this.runTest('Individual Worksheets', () => this.testIndividualWorksheets());
            this.runTest('No Time Estimates', () => this.testNoTimeEstimates());
            this.runTest('CSS File', () => this.testCSSFile());
            this.runTest('JavaScript File', () => this.testJavaScriptFile());

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        }

        this.printResults();
    }

    printResults() {
        console.log('\n📊 Test Results Summary');
        console.log('=' .repeat(50));
        
        const passed = this.testResults.filter(r => r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.status === 'FAILED').length;
        
        this.testResults.forEach(result => {
            const status = result.status === 'PASSED' ? '✅' : '❌';
            console.log(`${status} ${result.name}`);
            if (result.status === 'FAILED') {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        console.log('\n' + '=' .repeat(50));
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
        
        if (failed === 0) {
            console.log('\n🎉 All basic homepage tests passed!');
            console.log('💡 To run full browser tests, install Puppeteer: npm install puppeteer');
            console.log('   Then run: npm run test:homepage');
        } else {
            console.log(`\n⚠️  ${failed} test(s) failed. Please check the homepage implementation.`);
        }
    }
}

// Run the tests
const test = new BasicHomepageTest();
test.runAllTests();
