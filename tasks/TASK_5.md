# TASK 5: Implement App Version-Based Storage Clearing

## Problem Analysis

**Current Issue**: When worksheet questions are rewritten/modified, the saved localStorage progress becomes incompatible and breaks the user experience. Users currently have to manually clear storage or the app fails to load properly.

**Root Cause**: The app persists progress in localStorage using the key `pythonProgress` without any version checking mechanism. When worksheet content changes, the saved state references old problem structures that no longer exist.

**User Impact**:
- Broken user experience when worksheets are updated
- Manual intervention required to clear storage
- Potential data corruption or loading errors

## Proposed Solution

Implement an automatic storage clearing mechanism that detects when the app "version" has changed and clears localStorage accordingly. The most practical approach for a static website is to use the git commit hash as the version identifier.

### Approach Options Evaluated:

1. **Git Commit Hash** (Recommended)
   - Generate a version file during build with current commit hash
   - Check on app startup if stored version matches current version
   - Clear storage if versions differ

2. **Package.json version**
   - Requires manual version bumps
   - Less automatic than desired

3. **File modification timestamps**
   - Complex to implement reliably
   - Not suitable for static deployment

## Implementation Plan

### Step 1: Build-time Version Generation
- Create a build script that generates `version.js` with current git commit hash
- Update npm scripts with prebuild hooks to run version generation
- Add development mode handling to prevent constant storage clearing

### Step 2: HTML Script Loading
- Add `version.js` script tag to both `index.html` and `worksheet.html`
- Include error handling for missing version file
- Load version script before other application scripts

### Step 3: Version Checking System
- Add version checking logic to main app initialization points
- Store current version in localStorage
- Clear all storage when version mismatch detected with user-friendly logging

### Step 4: Integration Points
- Integrate version check into `script.js` init() function before loadWorksheets()
- Integrate version check into `worksheet.js` init() function before initPyodide()
- Ensure version checking happens before any progress loading attempts

## Files to be Modified/Created

### New Files:
- `scripts/generate-version.js` - Build script to create version file
- `version.js` - Generated file containing current commit hash (gitignored)

### Modified Files:
- `package.json` - Update build scripts with prebuild hooks for version generation
- `worksheet.js` - Add version checking to init() function before initPyodide() (around line 74-84)
- `script.js` - Add version checking to init() function before loadWorksheets() (around line 6-8)
- `index.html` - Add version.js script tag before other scripts
- `worksheet.html` - Add version.js script tag before other scripts
- `.gitignore` - Add version.js to ignore list

## Implementation Details

### Version Generation Script:
```javascript
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
```

### HTML Script Loading:
```html
<!-- Add to both index.html and worksheet.html before other scripts -->
<script src="version.js?t=cache-bust" onerror="window.APP_VERSION='dev-fallback'"></script>
```

### Package.json Script Updates:
```json
{
  "scripts": {
    "prebuild": "node scripts/generate-version.js",
    "build": "echo 'Static build complete - files ready for deployment'",
    "prestart": "node scripts/generate-version.js --dev",
    "predev": "node scripts/generate-version.js --dev"
  }
}
```

### Enhanced Storage Version Checking Logic:
```javascript
function checkAndClearOutdatedStorage() {
    try {
        if (typeof window.APP_VERSION === 'undefined') {
            console.warn('App version not available, skipping version check');
            return;
        }

        const currentVersion = window.APP_VERSION;
        const storedVersion = localStorage.getItem('appVersion');

        if (storedVersion && storedVersion !== currentVersion) {
            console.log(`📚 App updated (${storedVersion.substring(0,8)} → ${currentVersion.substring(0,8)}), clearing storage`);
            localStorage.clear();
        }

        localStorage.setItem('appVersion', currentVersion);
    } catch (error) {
        console.warn('Version check failed:', error);
        // Continue without version checking rather than breaking the app
    }
}
```

## Testing Strategy

### Unit Tests:
- Test version checking logic with various scenarios
- Mock localStorage operations
- Test fallback behavior when git commands fail

### Integration Tests:
- Test storage clearing on version change
- Verify progress persistence within same version
- Test build script execution

### Manual Testing:
- Verify version.js generation during build
- Test storage clearing by manually changing stored version
- Confirm normal operation when versions match

## Success Criteria

1. ✅ Build process automatically generates version.js with git commit hash
2. ✅ App checks version on startup and clears storage if version differs
3. ✅ Storage clearing is transparent to users (no error messages)
4. ✅ Normal progress saving/loading works when versions match
5. ✅ System works both in development and production builds
6. ✅ Graceful fallback when git is not available

## Potential Risks & Mitigation

**Risk**: Users lose progress when version changes
- **Mitigation**: This is the intended behavior - acceptable trade-off for preventing broken states

**Risk**: Build process fails if git is not available
- **Mitigation**: Implement fallback using timestamp-based version

**Risk**: Version file not loaded properly
- **Mitigation**: Graceful degradation - continue without version checking

**Risk**: Performance impact from version checking
- **Mitigation**: Minimal - single localStorage read on startup

## Implementation Notes

- Version checking should happen early in app initialization
- Use git commit hash for automatic version detection
- Fallback to timestamp-based version if git unavailable
- Clear ALL localStorage, not just progress data, to prevent any compatibility issues
- Include user-friendly console messages when storage is cleared for transparency

---

## Revision Notes

### Arch Agent Review Feedback & Changes Made

**Date**: 2025-09-23

**Arch Agent Key Feedback**:
1. ✅ **Script Loading Strategy**: Added explicit HTML script tag requirements with error handling
2. ✅ **Build Process Integration**: Enhanced package.json with proper prebuild hooks
3. ✅ **Development Workflow**: Added development mode handling to prevent constant clearing
4. ✅ **Integration Points**: Specified exact locations (script.js:6-8, worksheet.js:74-84)
5. ✅ **User Communication**: Enhanced logging with educational-appropriate messaging
6. ✅ **Error Handling**: Improved version checking with graceful degradation

**Changes Made Based on Feedback**:

1. **Enhanced Version Generation Script**:
   - Added development mode detection to use package.json version
   - Prevents constant storage clearing during development
   - Better fallback handling

2. **Explicit HTML Integration**:
   - Added script tag examples for both HTML files
   - Included error handling with fallback version
   - Specified loading order requirements

3. **Package.json Script Integration**:
   - Added prebuild, prestart, predev hooks
   - Development flag support for different environments

4. **Enhanced Version Checking Logic**:
   - Better error handling and graceful degradation
   - User-friendly console messaging with emoji
   - Handles missing APP_VERSION gracefully

5. **Specific Integration Points**:
   - `script.js` init() function before loadWorksheets() (line 6-8)
   - `worksheet.js` init() function before initPyodide() (line 74-84)
   - Ensures version checking happens before any progress loading

**Strategic Alignment Confirmed**:
- ✅ Solution aligns with static deployment model
- ✅ Appropriate for educational platform priorities
- ✅ Balances technical requirements with user experience
- ✅ Provides robust protection against storage corruption
- ✅ Maintains focus on seamless student learning experiences

The task plan now provides complete implementation details for handoff to a fresh agent session.