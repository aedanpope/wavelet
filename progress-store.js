// Handles all localStorage persistence for worksheet progress and app versioning.
//
// Exposes window.ProgressStore with:
//   checkVersion()                     — clears storage if app version has changed
//   saveWorksheet(id, state)           — persists serialised worksheet state
//   loadWorksheet(id) → state|null     — retrieves saved state, or null if none
//   clearWorksheet(id)                 — removes saved state for one worksheet
//   exportReport() → object            — returns all progress data (for future assessment export)

const ProgressStore = (() => {
    const PROGRESS_KEY = 'pythonProgress';
    const VERSION_KEY  = 'appVersion';

    // Local data that must SURVIVE a content-version bump. The "clear on update" below is meant
    // to reset student worksheet/project progress when content changes; it must NOT wipe the
    // teacher dashboard's local-only PDF names (they live on the teacher's device and are not
    // tied to any worksheet version). The teacher code itself is in sessionStorage, so it is
    // untouched by localStorage.clear() either way.
    const PRESERVE_KEYS = ['wavelet-pdf-names'];

    // Apply a content-version change to a storage: when the stored version differs from the
    // current one, clear it (resetting student progress) but carry over PRESERVE_KEYS, then
    // record the current version. storage + version are injectable so this is unit-testable;
    // checkVersion() passes the real localStorage and window.APP_VERSION.
    function applyVersion(storage, version) {
        if (!storage || typeof version === 'undefined') { return; }
        const stored = storage.getItem(VERSION_KEY);
        if (stored && stored !== version) {
            console.log(`📚 App updated (${stored.substring(0, 8)} → ${version.substring(0, 8)}), clearing storage`);
            const preserved = {};
            PRESERVE_KEYS.forEach((k) => {
                const v = storage.getItem(k);
                if (v !== null) { preserved[k] = v; }
            });
            storage.clear();
            Object.keys(preserved).forEach((k) => storage.setItem(k, preserved[k]));
        }
        storage.setItem(VERSION_KEY, version);
    }

    function checkVersion() {
        try {
            if (typeof window.APP_VERSION === 'undefined') {
                console.warn('App version not available, skipping version check');
                return;
            }
            applyVersion(localStorage, window.APP_VERSION);
        } catch (error) {
            console.warn('Version check failed:', error);
        }
    }

    function _loadAll() {
        try {
            return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        } catch {
            return {};
        }
    }

    function _saveAll(all) {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    }

    function saveWorksheet(worksheetId, state) {
        try {
            const all = _loadAll();
            all[worksheetId] = state;
            _saveAll(all);
        } catch (error) {
            console.warn('Failed to save progress:', error);
        }
    }

    function loadWorksheet(worksheetId) {
        return _loadAll()[worksheetId] || null;
    }

    function clearWorksheet(worksheetId) {
        try {
            const all = _loadAll();
            delete all[worksheetId];
            _saveAll(all);
        } catch (error) {
            console.warn('Failed to clear progress:', error);
        }
    }

    // Stub for Phase 3 (assessment export) — returns all saved progress as a plain object.
    function exportReport() {
        return _loadAll();
    }

    return { checkVersion, applyVersion, saveWorksheet, loadWorksheet, clearWorksheet, exportReport };
})();

if (typeof window !== 'undefined') { window.ProgressStore = ProgressStore; }
if (typeof module !== 'undefined' && module.exports) { module.exports = ProgressStore; }
