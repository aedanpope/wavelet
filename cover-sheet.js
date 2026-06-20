// Cover sheets (Project Storage v2, step 5). Generates the printable PDFs teachers
// hand out, from the teacher dashboard. See design_docs/PROJECT_STORAGE_V2.md §4.
//
// This first slice builds the FINAL / progress-pack sheet: one page per student with
// the identity block (name, project title, code, QR, typeable URL) plus the student's
// finished code, shrunk and cropped to a single page (the full program is always in
// the .py export, so a crop loses nothing).
//
// PDF rendering uses jsPDF + qrcode, loaded via CDN on the dashboard page (browser
// only). The pure layout helpers are exported for unit testing under V8 (no Node).

(function () {
    'use strict';

    // ── Pure helpers (unit-tested) ──────────────────────────────────────────

    // The URL a QR / typeable link points at: the project page with the student's
    // code in the URL *fragment* (after #), so it never reaches server logs or the
    // Referer header. project.js reads it to pre-fill login.
    function buildProjectUrl(origin, projectId, code) {
        const base = String(origin || '').replace(/\/+$/, '');
        return `${base}/project.html?project=${encodeURIComponent(projectId)}#code=${encodeURIComponent(code)}`;
    }

    // A short, typeable URL for laptop entry (wavelet.zone/?code=brave-otter-oak). The
    // homepage redirects it to the project's fragment form. This is the in-class path;
    // the QR (buildProjectUrl) is the direct, no-redirect take-home path.
    function buildShortUrl(origin, code) {
        const base = String(origin || '').replace(/\/+$/, '');
        return `${base}/?code=${encodeURIComponent(code)}`;
    }

    // Strip protocol and the slash before the query for a compact printed string
    // (https://wavelet.zone/?code=x -> wavelet.zone?code=x).
    function displayUrl(url) {
        return String(url).replace(/^https?:\/\//, '').replace(/\/\?/, '?');
    }

    // "Sam's Pixel Game" (falls back to just the project title when there's no name).
    function sheetTitle(name, projectTitle) {
        const n = (name || '').trim();
        return n ? `${n}'s ${projectTitle}` : projectTitle;
    }

    // Largest font (pt) in [minFont, maxFont] at which lineCount lines fit in
    // availableHeight; if even minFont can't fit them all, returns minFont (caller crops).
    function fitCodeFontSize(lineCount, geom) {
        const { availableHeight, maxFont, minFont, lineHeightRatio } = geom;
        for (let f = maxFont; f >= minFont; f -= 0.5) {
            if (lineCount * f * lineHeightRatio <= availableHeight) return f;
        }
        return minFont;
    }

    // How many lines of the given font fit in availableHeight.
    function linesThatFit(fontSize, geom) {
        return Math.max(1, Math.floor(geom.availableHeight / (fontSize * geom.lineHeightRatio)));
    }

    // Crop to maxLines, replacing the tail with a marker line so it's clear the code
    // was trimmed (and where to find the rest).
    function cropCodeLines(lines, maxLines) {
        if (lines.length <= maxLines) return { lines: lines.slice(), cropped: false };
        const shown = lines.slice(0, Math.max(0, maxLines - 1));
        shown.push('# ... (rest of your code is in your saved project)');
        return { lines: shown, cropped: true };
    }

    // Clip one line to maxChars characters, marking truncation with a trailing ellipsis.
    function clipLine(line, maxChars) {
        if (maxChars <= 1 || line.length <= maxChars) return line;
        return line.slice(0, maxChars - 1) + '…';
    }

    // ── PDF rendering (browser only; needs window.jspdf + window.QRCode) ─────

    const A4 = { w: 595.28, h: 841.89 };
    const MARGIN = 40;
    const QR_SIZE = 120;
    const CODE_GEOM = { maxFont: 9, minFont: 5, lineHeightRatio: 1.25 };

    // Render a QR for `text` to a PNG data URL by drawing the modules onto a canvas.
    // Uses qrcode-generator (global `qrcode`), whose isDark/getModuleCount API is stable;
    // going via a canvas means jsPDF gets a plain PNG (no dependence on the lib's own
    // image output format). `targetPx` is the desired pixel size of the rendered image.
    function qrDataUrl(text, targetPx) {
        const qr = window.qrcode(0, 'M'); // type 0 = auto-size to fit the data
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        const quiet = 4; // quiet-zone modules required by the spec
        const totalModules = count + quiet * 2;
        const scale = Math.max(1, Math.floor((targetPx || 256) / totalModules));
        const px = totalModules * scale;
        const canvas = document.createElement('canvas');
        canvas.width = px;
        canvas.height = px;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, px, px);
        ctx.fillStyle = '#000000';
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                if (qr.isDark(r, c)) {
                    ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
                }
            }
        }
        return canvas.toDataURL('image/png');
    }

    function renderOneFinalPage(doc, student, ctx) {
        const { projectTitle, origin, projectId } = ctx;
        const shortUrl = buildShortUrl(origin, student.code);

        // Identity block (left), QR (right).
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(sheetTitle(student.name, projectTitle), MARGIN, MARGIN + 14, { maxWidth: A4.w - 2 * MARGIN - QR_SIZE - 16 });

        doc.setFont('courier', 'bold');
        doc.setFontSize(15);
        doc.text(`Code:  ${student.code}`, MARGIN, MARGIN + 44);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90);
        doc.text('Scan to play at home, or type this on a laptop:', MARGIN, MARGIN + 64);
        doc.setTextColor(37, 99, 235);
        doc.text(displayUrl(shortUrl), MARGIN, MARGIN + 78, { maxWidth: A4.w - 2 * MARGIN - QR_SIZE - 16 });
        doc.setTextColor(0);

        // QR top-right with caption.
        const qrX = A4.w - MARGIN - QR_SIZE;
        const qrY = MARGIN;
        if (student.qr) doc.addImage(student.qr, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);

        // Divider.
        const dividerY = Math.max(MARGIN + 96, qrY + QR_SIZE + 14);
        doc.setDrawColor(210);
        doc.line(MARGIN, dividerY, A4.w - MARGIN, dividerY);

        // Code body label.
        const labelY = dividerY + 22;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Your finished code', MARGIN, labelY);

        // Code body: fit font, crop to page, clip long lines.
        const bodyTop = labelY + 14;
        const availableHeight = A4.h - MARGIN - bodyTop;
        const rawLines = String(student.content || '').replace(/\s+$/, '').split('\n');
        const geom = Object.assign({ availableHeight }, CODE_GEOM);
        const fontSize = fitCodeFontSize(rawLines.length, geom);
        const maxLines = linesThatFit(fontSize, geom);
        const { lines } = cropCodeLines(rawLines, maxLines);
        const maxChars = Math.floor((A4.w - 2 * MARGIN) / (fontSize * 0.6));

        doc.setFont('courier', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(20);
        const lineH = fontSize * CODE_GEOM.lineHeightRatio;
        lines.forEach((line, i) => {
            doc.text(clipLine(line, maxChars), MARGIN, bodyTop + (i + 1) * lineH);
        });
        doc.setTextColor(0);
    }

    // students: [{ name, code, content }]. Generates the multi-page PDF and downloads it.
    async function generateFinalSheets(opts) {
        const { students, projectId, projectTitle, origin, filename } = opts;
        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF not loaded');
        if (!window.qrcode) throw new Error('qrcode library not loaded');
        if (!students || !students.length) throw new Error('no students to print');

        const ctx = { projectId, projectTitle, origin: origin || window.location.origin };
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });

        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            s.qr = qrDataUrl(buildProjectUrl(ctx.origin, projectId, s.code), 256);
            if (i > 0) doc.addPage();
            renderOneFinalPage(doc, s, ctx);
        }
        doc.save(filename || `${projectId}-progress-sheets.pdf`);
    }

    const api = {
        buildProjectUrl, buildShortUrl, displayUrl, sheetTitle,
        fitCodeFontSize, linesThatFit, cropCodeLines, clipLine,
        generateFinalSheets
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CoverSheet = api;
})();
