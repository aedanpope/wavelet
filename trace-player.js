// Unified trace player for both embedded worksheet cards and the standalone scratchpad.
//
// Usage:
//   const player = new TracePlayer(steps, editor, elFn, options);
//
//   elFn(name) — returns the DOM element for a named control.
//     Embedded:   name => document.getElementById(`trace-card-${name}-${id}`)
//     Standalone: name => document.getElementById(`trace-${name}`)
//
//   options.playSpeed — function returning interval ms (default: () => 600)
//   options.onCleanup — optional callback fired by cleanup()
//
// Public API:
//   goToStep(n)   — jump to step n
//   play()        — start auto-playback
//   pause()       — stop auto-playback
//   cleanup()     — remove overlays and stop playback (for standalone reuse)

class TracePlayer {
    constructor(steps, editor, elFn, options = {}) {
        this.steps          = steps;
        this.editor         = editor;
        this._el            = elFn;
        this._playSpeed     = options.playSpeed || (() => 600);
        this._onCleanup     = options.onCleanup || null;
        this.currentStep    = -1;
        this.highlightedLine = -1;
        this.prevLocals     = {};
        this.highlightOverlay = null;
        this.playTimer      = null;
    }

    // ── Overlay ──────────────────────────────────────────────────────────────

    _ensureOverlay() {
        if (this.highlightOverlay) return;
        const scroller = this.editor.getScrollerElement();
        const overlay = document.createElement('div');
        overlay.className = 'trace-line-overlay';
        scroller.appendChild(overlay);
        this.highlightOverlay = overlay;
    }

    _moveOverlay(lineIdx, animate) {
        this._ensureOverlay();
        const lineTop    = this.editor.heightAtLine(lineIdx, 'local');
        const lineHeight = this.editor.defaultTextHeight();
        const ov = this.highlightOverlay;
        ov.style.transition = animate ? 'top 0.28s ease' : 'none';
        ov.style.top    = `${lineTop}px`;
        ov.style.height = `${lineHeight}px`;
        ov.style.display = 'block';
    }

    // ── Step Navigation ──────────────────────────────────────────────────────

    goToStep(n) {
        if (n < 0 || n >= this.steps.length) return;

        if (this.highlightedLine >= 0) {
            this.editor.removeLineClass(this.highlightedLine, 'gutter', 'trace-current-line-gutter');
        }

        this.currentStep = n;
        const step    = this.steps[n];
        const lineIdx = step.line - 1;
        const animate = this.highlightedLine >= 0 && this.highlightedLine !== lineIdx;

        this._moveOverlay(lineIdx, animate);
        this.editor.addLineClass(lineIdx, 'gutter', 'trace-current-line-gutter');
        this.editor.scrollIntoView({ line: lineIdx, ch: 0 }, 80);
        this.highlightedLine = lineIdx;

        this._renderVars(step.locals, step.for_ctx, step.phase, step.ann);
        this._renderOutput(n);
        this._updateControls();

        this.prevLocals = { ...step.locals };
    }

    // ── Variable Panel ───────────────────────────────────────────────────────

    _renderVars(locals, forCtx, phase, ann) {
        const panel = this._el('vars');
        const keys  = Object.keys(locals);
        let html = '';

        if (forCtx) {
            let iterHtml;
            if (forCtx.items && forCtx.items.length > 0) {
                const k = forCtx.iteration ?? 0;
                const itemsHtml = forCtx.items.map((item, idx) => {
                    let cls = 'trace-iter-item';
                    if (idx < k)                              cls += ' consumed';
                    else if (idx === k && phase === 'before') cls += ' current';
                    else if (idx <= k && phase === 'after')   cls += ' consumed';
                    return `<span class="${cls}">${escHtml(item)}</span>`;
                }).join('<span class="trace-iter-sep">, </span>');
                iterHtml = `[${itemsHtml}]`;
            } else {
                iterHtml = escHtml(forCtx.iter);
            }
            html += `<div class="trace-for-ctx">
                <span class="trace-for-kw">for</span>
                <span class="trace-for-target">${escHtml(forCtx.target)}</span>
                <span class="trace-for-kw">in</span>
                <span class="trace-for-iter-items">${iterHtml}</span>
            </div>`;
        }

        if (ann) {
            if (ann.type === 'loop_done') {
                html += `<div class="trace-ann trace-ann-done">loop complete</div>`;
            } else if (ann.type === 'loop_assigned') {
                html += `<div class="trace-ann trace-ann-assign">${escHtml(ann.value)} → ${escHtml(ann.var)}</div>`;
            } else if (ann.type === 'if_result') {
                const cls  = ann.value ? 'trace-ann-true' : 'trace-ann-false';
                const icon = ann.value ? '✓ true' : '✗ false';
                html += `<div class="trace-ann ${cls}">${escHtml(ann.cond)} → ${icon}</div>`;
            } else if (ann.type === 'print') {
                const preview = ann.preview != null
                    ? ` → <span class="trace-ann-print-val">"${escHtml(ann.preview)}"</span>`
                    : '';
                html += `<div class="trace-ann trace-ann-print">print${preview}</div>`;
            } else if (ann.type === 'if_test') {
                html += `<div class="trace-ann trace-ann-if">if ${escHtml(ann.cond)}</div>`;
            } else if (ann.type === 'eval') {
                html += `<div class="trace-ann trace-ann-eval">${escHtml(ann.expr)} → <span class="trace-ann-eval-val">${escHtml(ann.value)}</span></div>`;
            }
        }

        if (keys.length === 0 && !forCtx && !ann) {
            html += '<span class="trace-empty">No variables yet</span>';
        } else {
            html += keys.map(k => {
                const changed = this.prevLocals[k] !== locals[k];
                return `<div class="trace-var-row${changed ? ' trace-var-changed' : ''}">
                    <span class="trace-var-name">${escHtml(k)}</span>
                    <span class="trace-var-eq">=</span>
                    <span class="trace-var-value">${escHtml(locals[k])}</span>
                </div>`;
            }).join('');
        }

        panel.innerHTML = html;
    }

    // ── Output Panel ─────────────────────────────────────────────────────────

    _renderOutput(n) {
        const text    = (this.steps[n] && this.steps[n].output) || '';
        const content = this._el('output');
        const panel   = this._el('output-panel');
        if (content) content.textContent = text;
        if (panel)   panel.style.display = text ? 'block' : 'none';
    }

    // ── Controls ─────────────────────────────────────────────────────────────

    _updateControls() {
        const n   = this.currentStep;
        const max = this.steps.length - 1;
        const set = (name, val) => { const el = this._el(name); if (el) el.disabled = val; };
        set('first',  n <= 0);
        set('prev',   n <= 0);
        set('next',   n >= max);
        set('last',   n >= max);
        const slider = this._el('slider');
        if (slider) slider.value = n;
        const count = this._el('count');
        if (count) {
            const phase = this.steps[n].phase === 'after' ? ' · after' : '';
            count.textContent = `Step ${n + 1} / ${this.steps.length}${phase}`;
        }
        const playBtn = this._el('play');
        if (playBtn) playBtn.textContent = this.playTimer ? '⏸ Pause' : '▶ Play';
    }

    // ── Playback ─────────────────────────────────────────────────────────────

    play() {
        if (this.playTimer) return;
        if (this.currentStep >= this.steps.length - 1) this.goToStep(0);
        const playBtn = this._el('play');
        if (playBtn) playBtn.textContent = '⏸ Pause';
        const advance = () => {
            if (this.currentStep >= this.steps.length - 1) { this.pause(); return; }
            this.goToStep(this.currentStep + 1);
        };
        this.playTimer = setInterval(advance, this._playSpeed());
    }

    pause() {
        if (this.playTimer) { clearInterval(this.playTimer); this.playTimer = null; }
        const playBtn = this._el('play');
        if (playBtn) playBtn.textContent = '▶ Play';
    }

    // ── Cleanup (for standalone reuse between runs) ──────────────────────────

    cleanup() {
        this.pause();
        if (this.highlightedLine >= 0) {
            this.editor.removeLineClass(this.highlightedLine, 'gutter', 'trace-current-line-gutter');
            this.highlightedLine = -1;
        }
        if (this.highlightOverlay) {
            this.highlightOverlay.remove();
            this.highlightOverlay = null;
        }
        if (this._onCleanup) this._onCleanup();
    }
}

// escHtml is needed by _renderVars. Defined here so trace-player.js is self-contained.
// worksheet.js and scratchpad.js can remove their own copies.
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.TracePlayer = TracePlayer;
window.escHtml = escHtml;
