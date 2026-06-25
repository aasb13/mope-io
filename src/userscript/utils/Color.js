const COLOR_NAME_MAP = Object.freeze({
    black: '#000000',
    blue: '#0000ff',
    cyan: '#00ffff',
    green: '#008000',
    red: '#ff0000',
    transparent: 'rgba(0, 0, 0, 0)',
    white: '#ffffff',
    yellow: '#ffff00',
});

function clampColorChannel(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return 0;
    }

    return Math.max(0, Math.min(255, Math.round(numericValue)));
}

function clampColorAlpha(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return 1;
    }

    return Math.max(0, Math.min(1, numericValue));
}

class Color {
    constructor(value = 0) {
        this.decimal = 0;
        this.alpha = 1;
        this.set(value);
    }

    static from(value = 0) {
        return value instanceof Color ? value.clone() : new Color(value);
    }

    static parse(value) {
        if (value instanceof Color) {
            return {
                decimal: value.getDecimal(),
                alpha: value.getAlpha(),
            };
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return {
                decimal: Math.max(0, Math.min(0xFFFFFF, Math.round(value))),
                alpha: 1,
            };
        }

        if (value && typeof value === 'object') {
            if (Number.isFinite(value.decimal)) {
                return {
                    decimal: Math.max(0, Math.min(0xFFFFFF, Math.round(value.decimal))),
                    alpha: clampColorAlpha(value.alpha),
                };
            }

            if (
                Number.isFinite(value.r)
                || Number.isFinite(value.g)
                || Number.isFinite(value.b)
            ) {
                return {
                    decimal: (
                        (clampColorChannel(value.r) << 16)
                        | (clampColorChannel(value.g) << 8)
                        | clampColorChannel(value.b)
                    ),
                    alpha: clampColorAlpha(value.a ?? value.alpha),
                };
            }
        }

        if (typeof value === 'string') {
            const trimmedValue = value.trim();
            if (!trimmedValue) {
                return null;
            }

            const normalizedValue = COLOR_NAME_MAP[trimmedValue.toLowerCase()] || trimmedValue;

            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedValue)) {
                const hexBody = normalizedValue.slice(1);
                const expandedHex = hexBody.length === 3
                    ? hexBody.split('').map((char) => char + char).join('')
                    : hexBody;
                return {
                    decimal: parseInt(expandedHex, 16),
                    alpha: 1,
                };
            }

            const rgbMatch = normalizedValue.match(/^rgba?\(\s*([^)]+)\s*\)$/i);
            if (rgbMatch) {
                const parts = rgbMatch[1].split(',').map((part) => part.trim());
                if (parts.length === 3 || parts.length === 4) {
                    return {
                        decimal: (
                            (clampColorChannel(parts[0]) << 16)
                            | (clampColorChannel(parts[1]) << 8)
                            | clampColorChannel(parts[2])
                        ),
                        alpha: clampColorAlpha(parts[3]),
                    };
                }
            }

            if (/^\d+$/.test(normalizedValue)) {
                return {
                    decimal: Math.max(0, Math.min(0xFFFFFF, Math.round(Number(normalizedValue)))),
                    alpha: 1,
                };
            }
        }

        return null;
    }

    set(value) {
        const parsedColor = Color.parse(value);
        if (!parsedColor) {
            throw new Error(`Unsupported color value "${value}".`);
        }

        this.decimal = parsedColor.decimal;
        this.alpha = parsedColor.alpha;
        return this;
    }

    setDecimal(decimal) {
        return this.set(decimal);
    }

    setHex(hex) {
        return this.set(hex);
    }

    setRgb(r, g, b, a = this.alpha) {
        return this.set({ r, g, b, a });
    }

    clone() {
        return new Color({
            decimal: this.decimal,
            alpha: this.alpha,
        });
    }

    getDecimal() {
        return this.decimal;
    }

    getAlpha() {
        return this.alpha;
    }

    getHex() {
        return `#${this.decimal.toString(16).padStart(6, '0')}`;
    }

    getRgb() {
        return {
            r: (this.decimal >> 16) & 0xFF,
            g: (this.decimal >> 8) & 0xFF,
            b: this.decimal & 0xFF,
            a: this.alpha,
        };
    }

    toCanvasStyle() {
        if (this.alpha >= 1) {
            return this.getHex();
        }

        const rgb = this.getRgb();
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.alpha})`;
    }
}
