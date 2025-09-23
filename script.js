// Global variables
let worksheets = [];
const isDevMode = window.location.pathname.includes('/dev/');

// Check version and clear outdated storage
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

// Initialize the application
async function init() {
    try {
        // Check version and clear storage if needed
        checkAndClearOutdatedStorage();

        // Load worksheets index
        await loadWorksheets();
        
        // Show worksheet selection
        showWorksheetSelection();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please refresh the page.');
    }
}

// Load worksheets from the appropriate index file
async function loadWorksheets() {
    try {
        const basePath = isDevMode ? '../' : '';
        const indexFile = isDevMode ? 'worksheets/dev-index.json' : 'worksheets/index.json';
        const response = await fetch(basePath + indexFile + '?t=' + Date.now());
        const data = await response.json();
        worksheets = data.worksheets;
    } catch (error) {
        console.error('Error loading worksheets:', error);
        // Hide loading overlay and show error
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('worksheet-selection').style.display = 'block';
        throw new Error('Failed to load worksheets');
    }
}

// Show worksheet selection screen
function showWorksheetSelection() {
    // Hide loading overlay
    document.getElementById('loading-overlay').style.display = 'none';
    
    // Show worksheet selection
    document.getElementById('worksheet-selection').style.display = 'block';
    
    const grid = document.getElementById('worksheets-grid');
    grid.innerHTML = '';
    
    worksheets.forEach(worksheet => {
        const card = createWorksheetCard(worksheet);
        grid.appendChild(card);
    });
}

// Create a worksheet card
function createWorksheetCard(worksheet) {
    const card = document.createElement('a');
    card.className = 'worksheet-card';
    
    // Adjust href based on dev mode
    const basePath = isDevMode ? '../' : '';
    card.href = `${basePath}worksheet.html?id=${worksheet.id}`;
    
    card.innerHTML = `
        <h3>${worksheet.title}</h3>
        <p>${worksheet.description}</p>
    `;
    
    return card;
}

// Show error message
function showError(message) {
    const output = document.getElementById('output');
    if (output) {
        output.textContent = message;
        output.className = 'output error';
    } else {
        alert(message);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
