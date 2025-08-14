// Global variables
let worksheets = [];

// Initialize the application
async function init() {
    try {
        // Load worksheets index
        await loadWorksheets();
        
        // Show worksheet selection
        showWorksheetSelection();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please refresh the page.');
    }
}

// Load worksheets from the index file
async function loadWorksheets() {
    try {
        const response = await fetch('worksheets/index.json?t=' + Date.now());
        const data = await response.json();
        worksheets = data.worksheets;
    } catch (error) {
        console.error('Error loading worksheets:', error);
        throw new Error('Failed to load worksheets');
    }
}



// Show worksheet selection screen
function showWorksheetSelection() {
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
    card.href = `worksheet.html?id=${worksheet.id}`;
    
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
