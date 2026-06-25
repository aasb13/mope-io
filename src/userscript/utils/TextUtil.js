function getHexdump(buffer) {
    const bytes = new Uint8Array(buffer);
    const rows = [];
    const rowSize = 16;

    for (let i = 0; i < bytes.length; i += rowSize) {
        const offset = i.toString(16).padStart(8, '0').toUpperCase();
        const hexParts = [];
        const asciiParts = [];

        for (let j = 0; j < rowSize; j++) {
            if (i + j < bytes.length) {
                const byte = bytes[i + j];
                hexParts.push(byte.toString(16).padStart(2, '0').toUpperCase());
                asciiParts.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
            } else {
                hexParts.push('  ');
                asciiParts.push(' ');
            }
        }

        const hexString = `${hexParts.slice(0, 8).join(' ')}  ${hexParts.slice(8).join(' ')}`;
        rows.push(`${offset}  ${hexString}  |${asciiParts.join('')}|`);
    }

    return rows.join('\n');
}

function decodeUTF8(str) {
    try {
        return decodeURIComponent(escape(str));
    } catch (error) {
        return str;
    }
}

function formatCompactNumber(value, minimumFractionDigits = 0) {
    if (value == null || value === 0) {
        return '0';
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return '0';
    }

    // Reference: assets/deobf.js _0x189f78.
    const safeFractionDigits = !Number.isFinite(minimumFractionDigits) || minimumFractionDigits < 0
        ? 0
        : Math.floor(minimumFractionDigits);
    const precisionParts = numericValue.toPrecision(2).split('e');
    const suffixIndex = precisionParts.length === 1
        ? 0
        : Math.floor(Math.min(Number(precisionParts[1].slice(1)), 14) / 3);
    const scaledValue = suffixIndex < 1
        ? numericValue.toFixed(safeFractionDigits)
        : (numericValue / Math.pow(10, suffixIndex * 3)).toFixed(2);
    const displayValue = scaledValue < 0 ? scaledValue : Math.abs(scaledValue);
    return displayValue + ['', 'K', 'M', 'B', 'T'][suffixIndex];
}

function formatDurationSeconds(totalSeconds = 0) {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds - hours * 3600) / 60);
    const seconds = safeSeconds - hours * 3600 - minutes * 60;
    const hasHours = hours >= 1;
    const hasMinutes = hasHours || minutes >= 1;
    let formatted = '';

    // Reference: assets/deobf.js _0x12d942.
    if (hasHours) {
        formatted += `${hours}h `;
    }
    if (hasMinutes) {
        formatted += `${minutes}m `;
    }
    formatted += `${seconds}s`;

    return formatted;
}
