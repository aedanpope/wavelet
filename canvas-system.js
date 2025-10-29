// Canvas system for grid-based drawing in Python learning platform
// Provides draw(), show(), clear() functions and manages canvas state

/**
 * Canvas configuration constants
 */
const CanvasConfig = {
    GRID3: {
        name: 'GRID3',
        dimensions: [3, 3],
        cellSize: 120,  // Desktop: 120px per cell = 360px total
        mobileCellSize: 90,  // Mobile: 90px per cell = 270px total
        showGridLines: true,
        showCoordinates: true
    },
    GRID100: {
        name: 'GRID100',
        dimensions: [100, 100],
        cellSize: 5,  // Desktop: 5px per cell = 500px total
        mobileCellSize: 4,  // Mobile: 4px per cell = 400px total
        showGridLines: false,
        showCoordinates: false
    }
};

/**
 * Sets up canvas functions in the Pyodide environment
 * @param {Object} pyodide - The Pyodide instance
 * @param {number} problemIndex - The index of the problem (use -1 for validation mode to skip DOM manipulation)
 *
 * Note: When problemIndex is -1, the canvas functions are set up in Python but no DOM
 * elements are created/modified. This is used during validation to test student code
 * without interfering with the visible canvas in the UI.
 */
function setupCanvasFunctions(pyodide, problemIndex) {
    // Initialize canvas state in Python
    pyodide.runPython(`
# Canvas state - internal, not exposed to students
_canvas_state = {
    'grid': {},           # Sparse dict: {(x, y): 'color'}
    'size': None,         # 'GRID3' or 'GRID100'
    'dimensions': None,   # (width, height)
    'commands': [],       # [{type: 'draw', x, y, color}, ...]
    'initialized': False
}

# Grid size constants (exposed to students)
GRID3 = 'GRID3'
GRID100 = 'GRID100'
`);

    // Create use_canvas function
    const useCanvas = function(gridSize) {
        // Validate grid size
        if (gridSize !== 'GRID3' && gridSize !== 'GRID100') {
            console.error(`Invalid grid size: ${gridSize}`);
            pyodide.runPython(`print("Warning: Invalid grid size. Use GRID3 or GRID100.")`);
            return;
        }

        const config = CanvasConfig[gridSize];

        // Update Python state
        pyodide.runPython(`
_canvas_state['size'] = '${gridSize}'
_canvas_state['dimensions'] = (${config.dimensions[0]}, ${config.dimensions[1]})
_canvas_state['initialized'] = True
_canvas_state['grid'] = {}
_canvas_state['commands'] = []
`);

        // Create canvas element if it doesn't exist
        createCanvasElement(problemIndex, config);
    };

    // Define draw function in Python
    pyodide.runPython(`
def draw(x, y, color='black'):
    """Draw a colored cell at coordinate (x, y)."""
    if not _canvas_state['initialized']:
        print("Warning: You need to call use_canvas(GRID3) or use_canvas(GRID100) before drawing!")
        return

    width, height = _canvas_state['dimensions']

    # Validate bounds
    if not (0 <= x < width and 0 <= y < height):
        print(f"Warning: Oops! ({x}, {y}) is outside the {_canvas_state['size']} canvas ({width}x{height}). Try smaller numbers!")
        return

    # Normalize color (basic validation, JS will handle CSS parsing)
    color_str = str(color)

    # Update state
    _canvas_state['grid'][(x, y)] = color_str

    # Queue command for rendering
    _canvas_state['commands'].append({
        'type': 'draw',
        'x': x,
        'y': y,
        'color': color_str
    })
`);

    // Define show function in Python
    pyodide.runPython(`
def show():
    """Flush canvas commands to render."""
    pass  # JavaScript will handle the actual flushing
`);

    // Create show wrapper in JavaScript
    const showWrapper = function() {
        if (!pyodide.globals.get('_canvas_state').get('initialized')) {
            console.log('Canvas not initialized, skipping show()');
            return;
        }
        flushCanvas(pyodide, problemIndex);
    };

    // Define clear function in Python
    pyodide.runPython(`
def clear():
    """Reset canvas to all white."""
    if not _canvas_state['initialized']:
        print("Warning: You need to call use_canvas(GRID3) or use_canvas(GRID100) before clearing!")
        return

    _canvas_state['grid'] = {}
    _canvas_state['commands'] = [{'type': 'clear'}]
`);

    // Inject functions into Python global scope
    pyodide.globals.set('use_canvas', useCanvas);

    // draw and clear are already defined in Python above
    // Override show with JS wrapper for actual rendering
    pyodide.globals.set('show', showWrapper);
}

/**
 * Creates the canvas HTML element in the output area
 * @param {number} problemIndex - The index of the problem (-1 for validation mode)
 * @param {Object} config - Canvas configuration
 *
 * Note: When problemIndex is -1 (validation mode), this function returns early without
 * creating any DOM elements. This prevents validation runs from interfering with the
 * visible canvas that displays the student's actual output.
 */
function createCanvasElement(problemIndex, config) {
    // Skip DOM manipulation during validation (problemIndex === -1)
    if (problemIndex < 0) {
        return;
    }

    const outputElement = document.getElementById(`output-${problemIndex}`);
    if (!outputElement) {
        console.error(`Output element not found for problem ${problemIndex}`);
        return;
    }

    // Check if canvas already exists
    let canvasContainer = document.getElementById(`canvas-container-${problemIndex}`);
    if (canvasContainer) {
        // Canvas already exists, just clear it and redraw grid
        const canvas = canvasContainer.querySelector('canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Redraw grid lines if enabled
            const isMobile = window.innerWidth <= 768;
            const cellSize = isMobile ? config.mobileCellSize : config.cellSize;
            if (config.showGridLines) {
                drawGridLines(ctx, canvas.width, canvas.height, cellSize, config.dimensions);
            }
        }
        return;
    }

    // Create canvas container
    canvasContainer = document.createElement('div');
    canvasContainer.id = `canvas-container-${problemIndex}`;
    canvasContainer.className = 'canvas-container';

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.id = `canvas-${problemIndex}`;
    canvas.className = `canvas ${config.name.toLowerCase()}`;

    // Set canvas dimensions (actual pixel dimensions)
    const isMobile = window.innerWidth <= 768;
    const cellSize = isMobile ? config.mobileCellSize : config.cellSize;
    const canvasSize = cellSize * config.dimensions[0];

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.width = canvasSize + 'px';
    canvas.style.height = canvasSize + 'px';

    // Initialize with white background
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines if enabled
    if (config.showGridLines) {
        drawGridLines(ctx, canvas.width, canvas.height, cellSize, config.dimensions);
    }

    // Create grid layout wrapper for canvas + labels
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'canvas-grid-wrapper';

    // Draw coordinate labels if enabled
    if (config.showCoordinates) {
        const { yLabels, xLabels } = createCoordinateLabels(config.dimensions, cellSize);

        // Add elements in grid order: y-labels, canvas, spacer, x-labels
        gridWrapper.appendChild(yLabels);
        gridWrapper.appendChild(canvas);

        const spacer = document.createElement('div');
        spacer.className = 'canvas-label-spacer';
        gridWrapper.appendChild(spacer);

        gridWrapper.appendChild(xLabels);
    } else {
        gridWrapper.appendChild(canvas);
    }

    canvasContainer.appendChild(gridWrapper);

    // Insert canvas at the beginning of output area (above text output)
    outputElement.insertBefore(canvasContainer, outputElement.firstChild);
}

/**
 * Draws grid lines on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} cellSize - Size of each cell
 * @param {Array} dimensions - [width, height] in cells
 */
function drawGridLines(ctx, width, height, cellSize, dimensions) {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let i = 0; i <= dimensions[0]; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let i = 0; i <= dimensions[1]; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(width, i * cellSize);
        ctx.stroke();
    }
}

/**
 * Creates coordinate labels for the canvas
 * @param {Array} dimensions - [width, height] in cells
 * @param {number} cellSize - Size of each cell
 * @returns {Object} Object containing yLabels and xLabels elements
 */
function createCoordinateLabels(dimensions, cellSize) {
    // X-axis labels (bottom)
    const xLabels = document.createElement('div');
    xLabels.className = 'canvas-labels-x';
    for (let x = 0; x < dimensions[0]; x++) {
        const label = document.createElement('span');
        label.textContent = x;
        label.style.width = cellSize + 'px';
        xLabels.appendChild(label);
    }

    // Y-axis labels (left side, bottom to top)
    const yLabels = document.createElement('div');
    yLabels.className = 'canvas-labels-y';
    for (let y = dimensions[1] - 1; y >= 0; y--) {
        const label = document.createElement('span');
        label.textContent = y;
        label.style.height = cellSize + 'px';
        yLabels.appendChild(label);
    }

    return { yLabels, xLabels };
}

/**
 * Flushes queued canvas commands and renders them
 * @param {Object} pyodide - The Pyodide instance
 * @param {number} problemIndex - The index of the problem
 */
function flushCanvas(pyodide, problemIndex) {
    // Get canvas state from Python - don't convert grid (has tuple keys)
    const canvasStatePy = pyodide.globals.get('_canvas_state');
    const commands = canvasStatePy.get('commands').toJs();
    const size = canvasStatePy.get('size');
    const dimensions = canvasStatePy.get('dimensions').toJs();

    if (!commands || commands.length === 0) {
        return;
    }

    const canvas = document.getElementById(`canvas-${problemIndex}`);
    if (!canvas) {
        console.error(`Canvas not found for problem ${problemIndex}`);
        return;
    }

    const ctx = canvas.getContext('2d');
    const config = CanvasConfig[size];
    const isMobile = window.innerWidth <= 768;
    const cellSize = isMobile ? config.mobileCellSize : config.cellSize;

    // Process each command
    commands.forEach(cmd => {
        // Commands are JavaScript Maps, use .get() to access properties
        const cmdType = cmd.get ? cmd.get('type') : cmd.type;

        if (cmdType === 'clear') {
            // Clear entire canvas
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Redraw grid lines if enabled
            if (config.showGridLines) {
                drawGridLines(ctx, canvas.width, canvas.height, cellSize, dimensions);
            }
        } else if (cmdType === 'draw') {
            // Get coordinates from Map
            const x = cmd.get ? cmd.get('x') : cmd.x;
            const y = cmd.get ? cmd.get('y') : cmd.y;
            const color = cmd.get ? cmd.get('color') : cmd.color;

            // Flip Y coordinate for bottom-left origin
            const flippedY = dimensions[1] - 1 - y;

            // Validate and set color
            ctx.fillStyle = validateColor(color);

            // Calculate position and size
            const rectX = x * cellSize;
            const rectY = flippedY * cellSize;

            // Draw cell
            ctx.fillRect(rectX, rectY, cellSize, cellSize);

            // Redraw grid line for this cell if enabled
            if (config.showGridLines) {
                ctx.strokeStyle = '#ccc';
                ctx.lineWidth = 1;
                ctx.strokeRect(rectX, rectY, cellSize, cellSize);
            }
        }
    });

    // Clear command buffer in Python
    pyodide.runPython(`_canvas_state['commands'] = []`);
}

/**
 * Validates and normalizes a color string
 * @param {string} color - Color string (named or hex)
 * @returns {string} Valid CSS color or 'black' as fallback
 */
function validateColor(color) {
    // Test if color is valid CSS color
    const testDiv = document.createElement('div');
    testDiv.style.color = color;

    if (testDiv.style.color) {
        return color;
    }

    // Invalid color, return black
    console.warn(`Invalid color: ${color}, using black instead`);
    return 'black';
}

/**
 * Auto-flush canvas after code execution completes
 * Called from code-executor.js after runPythonAsync
 * @param {Object} pyodide - The Pyodide instance
 * @param {number} problemIndex - The index of the problem
 */
function autoFlushCanvas(pyodide, problemIndex) {
    try {
        const canvasState = pyodide.globals.get('_canvas_state');
        if (canvasState && canvasState.get('initialized')) {
            flushCanvas(pyodide, problemIndex);
        }
    } catch (error) {
        // Canvas not initialized, skip silently
    }
}

/**
 * Resets canvas state when Python environment is reset
 * Called from code-executor.js in resetPythonEnvironment
 * @param {number} problemIndex - The index of the problem
 */
function resetCanvasState(problemIndex) {
    // Don't remove the canvas DOM element - it will be reused
    // The Python canvas state will be reinitialized when setupCanvasFunctions is called
    // This prevents flickering during validation which resets the environment multiple times
}

/**
 * Gets the canvas state for validation purposes
 * @param {Object} pyodide - The Pyodide instance
 * @returns {Object} Canvas state object with grid
 */
function getCanvasState(pyodide) {
    try {
        const canvasState = pyodide.globals.get('_canvas_state');
        if (!canvasState) {
            return null;
        }
        return canvasState.toJs();
    } catch (error) {
        console.error('Error getting canvas state:', error);
        return null;
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupCanvasFunctions,
        autoFlushCanvas,
        resetCanvasState,
        getCanvasState,
        CanvasConfig
    };
}
