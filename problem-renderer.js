// Rendering functions for worksheet problem blocks.
//
// Handles all DOM creation for the three block types (problem, concept, trace)
// and the shared output display. worksheet.js owns state; this module owns markup.
//
// Exposes window.ProblemRenderer with:
//   createProblemElement(problem, index)        → HTMLElement
//   createConceptElement(block)                 → HTMLElement
//   createTraceElement(block, traceIndex)       → HTMLElement
//   createEditor(containerEl, problem)          → CodeMirror instance
//   createTraceEditor(containerEl, block)       → CodeMirror instance
//   displayOutput(el, content, type, message)   → void

const ProblemRenderer = (() => {

    function createProblemElement(problem, index) {
        const problemDiv = document.createElement('div');
        problemDiv.className = 'problem-container';
        problemDiv.id = `problem-${index}`;

        let inputsHTML = '';
        if (problem.inputs && problem.inputs.length > 0) {
            inputsHTML = `
                <div class="input-section">
                    <div class="input-fields" id="input-fields-${index}">
                        ${problem.inputs.map(input => `
                            <div class="input-field">
                                <label for="input-${index}-${input.name}">${input.name} =</label>
                                <input
                                    type="${input.type}"
                                    id="input-${index}-${input.name}"
                                    name="${input.name}"
                                    placeholder="${input.placeholder || ''}"
                                    class="problem-input"
                                >
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        problemDiv.innerHTML = `
            <div class="problem-header">
                <h2>Problem ${index + 1}: ${problem.title}</h2>
            </div>
            <div class="problem-content">
                <div class="explanation">
                    <div class="problem-content-text">${problem.content}</div>
                    <div class="task-box">
                        <h4>Your Task:</h4>
                        <p>${problem.task}</p>
                    </div>
                </div>
                <div class="code-section">
                    <div class="code-header">
                        <h4>Your Code</h4>
                        <div class="code-controls">
                            <button class="hint-btn" onclick="showHint(${index})">💡 Hint</button>
                            <button class="reset-btn" onclick="resetProblem(${index})">🔄 Reset</button>
                        </div>
                    </div>
                    <div class="code-editor" id="code-editor-${index}"></div>
                    ${inputsHTML}
                    <div class="output-section">
                        <div class="output-header">
                            <span>Output</span>
                            <button class="run-btn" onclick="runCode(${index})">▶ Run Code</button>
                        </div>
                        <div class="output" id="output-${index}">
                            <div class="output-placeholder">Click "Run Code" to see your output here</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return problemDiv;
    }

    function createConceptElement(block) {
        const div = document.createElement('div');
        div.className = 'concept-card';

        const examplesHTML = block.examples ? `
            <div class="concept-examples">
                ${block.examples.map(ex => `
                    <div class="concept-example">
                        <span class="example-input">You type <strong>${ex.input}</strong></span>
                        <span class="example-arrow">→</span>
                        <span class="example-code">Python sees <code>${ex.substituted}</code></span>
                        <span class="example-arrow">→</span>
                        <span class="example-output">prints <strong>${ex.output}</strong></span>
                    </div>
                `).join('')}
            </div>
        ` : '';

        const footerHTML = block.footer ? `<p class="concept-footer">${block.footer}</p>` : '';

        div.innerHTML = `
            <div class="concept-header">
                <span class="concept-icon">${block.icon || '💡'}</span>
                <h3>${block.title}</h3>
            </div>
            <div class="concept-body">
                ${block.content}
                ${examplesHTML}
                ${footerHTML}
            </div>
        `;

        return div;
    }

    function createTraceElement(block, traceIndex) {
        const id = traceIndex;
        const div = document.createElement('div');
        div.className = 'trace-card';
        div.innerHTML = `
            <div class="trace-card-header">
                <span class="trace-card-icon">▶</span>
                <h3>${block.title || 'Watch it run'}</h3>
            </div>
            <p class="trace-card-instruction">Click ▶ or drag the slider to watch the code run step by step.</p>
            <div class="trace-card-footer">
                <div class="trace-step-count" id="trace-card-count-${id}">Step 1 / ${block.steps.length}</div>
                <div class="trace-card-controls">
                    <button class="trace-btn" id="trace-card-first-${id}" title="First step">⏮</button>
                    <button class="trace-btn" id="trace-card-prev-${id}" title="Previous step">◀</button>
                    <button class="trace-btn" id="trace-card-next-${id}" title="Next step">▶</button>
                    <button class="trace-btn" id="trace-card-last-${id}" title="Last step">⏭</button>
                    <button class="trace-btn trace-btn-play" id="trace-card-play-${id}">▶ Play</button>
                    <input class="trace-slider" type="range" id="trace-card-slider-${id}" min="0" max="${block.steps.length - 1}" value="0">
                </div>
            </div>
            <div class="trace-card-layout">
                <div class="trace-card-editor-wrap">
                    <div id="trace-card-editor-${id}"></div>
                </div>
                <div class="trace-card-vars-col" id="trace-card-vars-col-${id}">
                    <div class="trace-panel-title">Variables</div>
                    <div class="trace-vars" id="trace-card-vars-${id}"><span class="trace-empty">No variables yet</span></div>
                </div>
                <div class="trace-card-output-col" id="trace-card-output-col-${id}">
                    <div class="trace-panel-title">Output</div>
                    <div class="trace-output-content" id="trace-card-output-${id}"></div>
                </div>
            </div>
        `;
        return div;
    }

    /** Create and return a CodeMirror editor for a student problem. */
    function createEditor(containerEl, problem) {
        const editor = CodeMirror(containerEl, {
            mode: 'python',
            theme: 'monokai',
            lineNumbers: true,
            indentUnit: 2,
            tabSize: 2,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            extraKeys: { 'Tab': cm => cm.replaceSelection('  ', 'end') }
        });
        editor.setValue(problem.starterCode || '');
        const height = problem.codeHeight || 3;
        editor.setSize(null, height * 23 + 10);
        return editor;
    }

    /** Create and return a read-only CodeMirror editor for a trace card.
     *  Width is sized to fit the code content (no h-scroll, no wasted space). */
    function createTraceEditor(containerEl, block) {
        const lineCount = block.code.split('\n').length;
        const editorHeight = lineCount * 23 + 33;
        const editor = CodeMirror(containerEl, {
            mode: 'python',
            theme: 'monokai',
            lineNumbers: true,
            readOnly: true,
            value: block.code,
            indentUnit: 2,
            tabSize: 2,
        });
        // Shrink to 1px so scrollWidth reports true content width, then size to fit
        editor.setSize(1, editorHeight);
        editor.refresh();
        const contentWidth = editor.getScrollerElement().scrollWidth;
        editor.setSize(contentWidth, editorHeight);
        return editor;
    }

    /** Render execution output into the output element. Preserves any canvas child. */
    function displayOutput(outputElement, content, type = 'normal', message = null) {
        const existingCanvas = outputElement.querySelector('.canvas-container');

        outputElement.innerHTML = '';
        outputElement.className = `output ${type}`;

        if (existingCanvas) outputElement.appendChild(existingCanvas);

        const scroll = document.createElement('div');
        scroll.className = 'output-text-scroll';

        if (!content.trim() && type !== 'running') {
            const empty = document.createElement('div');
            empty.className = 'output-empty';
            empty.textContent = '<program ran and produced no output>';
            scroll.appendChild(empty);
        }

        if (content.trim()) {
            const lines = content.split('\n');
            let truncated = content;
            let wasTruncated = false;
            if (lines.length > 1000) {
                truncated = lines.slice(0, 1000).join('\n');
                wasTruncated = true;
            }
            const contentDiv = document.createElement('div');
            contentDiv.className = 'output-content';
            contentDiv.textContent = truncated;
            scroll.appendChild(contentDiv);
            if (wasTruncated) {
                const truncDiv = document.createElement('div');
                truncDiv.className = 'output-truncated';
                truncDiv.textContent = `Output truncated after 1000 lines (${lines.length} total lines). This prevents browser crashes.`;
                scroll.appendChild(truncDiv);
            }
        }

        if (message) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `output-message ${type}`;
            msgDiv.textContent = message;
            scroll.appendChild(msgDiv);
        }

        outputElement.appendChild(scroll);
    }

    return {
        createProblemElement,
        createConceptElement,
        createTraceElement,
        createEditor,
        createTraceEditor,
        displayOutput,
    };
})();

window.ProblemRenderer = ProblemRenderer;
