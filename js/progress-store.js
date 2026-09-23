(function (root) {
    'use strict';
    function createProgressStore(storageProvider, levelCount = 5) {
        const key = 'nightmarket-progress';
        const legacyKey = 'nightmarket-cleared-levels';
        let memory = 0;
        let unavailable = false;
        function valid(value) {
            return Number.isInteger(value) && value >= 0 ? Math.min(levelCount, value) : 0;
        }
        function read() {
            try {
                const storage = storageProvider();
                let current = 0;
                try {
                    const data = JSON.parse(storage.getItem(key));
                    if (data && data.version === 1) current = valid(data.clearedLevels);
                } catch (_) { /* Fall back to legacy progress on malformed JSON. */ }
                const legacy = storage.getItem(legacyKey);
                memory = Math.max(memory, current, legacy === null ? 0 : valid(Number(legacy)));
            } catch (_) { unavailable = true; }
            return memory;
        }
        function write(count) {
            memory = Math.max(read(), valid(count));
            try {
                const storage = storageProvider();
                storage.setItem(key, JSON.stringify({ version: 1, clearedLevels: memory }));
                storage.setItem(legacyKey, String(memory));
            } catch (_) { unavailable = true; }
            return memory;
        }
        return { read, write, get unavailable() { return unavailable; } };
    }
    const api = { createProgressStore };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NightMarketProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
