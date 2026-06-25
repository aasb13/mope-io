function debugLog(options = {}) {
    const {
        win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window,
        module = 'Userscript',
        key = 'info',
        message = '',
        details = null,
        throttleMs = 0,
        timestamps = null,
    } = options;

    const now = Date.now();
    const timestampMap = timestamps instanceof Map ? timestamps : null;
    const lastAt = timestampMap ? (timestampMap.get(key) || 0) : 0;
    if ((now - lastAt) < throttleMs) {
        return false;
    }
    if (timestampMap) {
        timestampMap.set(key, now);
    }

    const root = win || window;
    const normalizedDetails = details && typeof details === 'object' ? details : {};
    if (typeof root.__mopEngineDebugLog === 'function') {
        root.__mopEngineDebugLog(module, key, message, normalizedDetails);
        return true;
    }

    root.__mopEngineDebugLogs = Array.isArray(root.__mopEngineDebugLogs) ? root.__mopEngineDebugLogs : [];
    root.__mopEngineDebugLogs.push({
        timestamp: new Date().toISOString(),
        module,
        key,
        message,
        details: normalizedDetails,
    });

    if (root.__mopEngineDebugLogs.length > 1000) {
        root.__mopEngineDebugLogs.shift();
    }

    return true;
}
