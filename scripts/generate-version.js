// scripts/generate-version.js
const { execSync } = require('child_process');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

try {
    if (isDev) {
        // Use package.json version in development to avoid constant clearing
        const pkg = require('../package.json');
        const versionContent = `window.APP_VERSION = '${pkg.version}-dev';`;
        fs.writeFileSync('version.js', versionContent);
        console.log(`Generated version.js with dev version: ${pkg.version}-dev`);
    } else {
        const commitHash = execSync('git rev-parse HEAD').toString().trim();
        const versionContent = `window.APP_VERSION = '${commitHash}';`;
        fs.writeFileSync('version.js', versionContent);
        console.log(`Generated version.js with commit: ${commitHash.substring(0, 8)}`);
    }
} catch (error) {
    console.warn('Could not generate version, using fallback');
    const fallbackContent = `window.APP_VERSION = 'dev-${Date.now()}';`;
    fs.writeFileSync('version.js', fallbackContent);
}