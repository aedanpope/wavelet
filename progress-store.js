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

    function checkVersion() {
        try {
            if (typeof window.APP_VERSION === 'undefined') {
                console.warn('App version not available, skipping version check');
                return;
            }
            const current = window.APP_VERSION;
            const stored  = localStorage.getItem(VERSION_KEY);
            if (stored && stored !== current) {
                console.log(`📚 App updated (${stored.substring(0, 8)} → ${current.substring(0, 8)}), clearing storage`);
                localStorage.clear();
            }
            localStorage.setItem(VERSION_KEY, current);
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

    return { checkVersion, saveWorksheet, loadWorksheet, clearWorksheet, exportReport };
})();

window.ProgressStore = ProgressStore;
