const FontUtil = Object.freeze({
    FAMILY: '"Trebuchet MS", "DejaVu Sans", sans-serif',
    MONO_FAMILY: '"Consolas", "Liberation Mono", monospace',

    buildFont(options = {}) {
        const size = Number.isFinite(options.size) ? options.size : 14;
        const weight = options.weight || '500';
        const style = options.style || 'normal';
        const family = options.family || FontUtil.FAMILY;
        return `${style} ${weight} ${size}px ${family}`;
    },

    applyFont(ctx, options = {}) {
        ctx.font = FontUtil.buildFont(options);
        ctx.textAlign = options.align || 'left';
        ctx.textBaseline = options.baseline || 'middle';
    },

    measureText(ctx, text, options = {}) {
        ctx.save();
        FontUtil.applyFont(ctx, options);
        const metrics = ctx.measureText(String(text ?? ''));
        ctx.restore();
        return metrics;
    },

    trimTextToWidth(ctx, text, maxWidth, options = {}) {
        const content = String(text ?? '');
        if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
            return '';
        }

        ctx.save();
        FontUtil.applyFont(ctx, options);
        if (ctx.measureText(content).width <= maxWidth) {
            ctx.restore();
            return content;
        }

        const ellipsis = '...';
        let value = content;
        while (value.length > 0 && ctx.measureText(value + ellipsis).width > maxWidth) {
            value = value.slice(0, -1);
        }
        ctx.restore();
        return value ? value + ellipsis : ellipsis;
    },

    wrapText(ctx, text, maxWidth, options = {}) {
        const content = String(text ?? '');
        if (!content) {
            return [''];
        }

        if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
            return [content];
        }

        ctx.save();
        FontUtil.applyFont(ctx, options);
        const words = content.split(/\s+/);
        const lines = [];
        let line = '';

        for (let index = 0; index < words.length; index += 1) {
            const word = words[index];
            const nextLine = line ? `${line} ${word}` : word;
            if (ctx.measureText(nextLine).width <= maxWidth || !line) {
                line = nextLine;
                continue;
            }

            lines.push(line);
            line = word;
        }

        if (line) {
            lines.push(line);
        }

        ctx.restore();
        return lines;
    },

    drawText(ctx, text, x, y, options = {}) {
        const content = String(text ?? '');
        ctx.save();
        FontUtil.applyFont(ctx, options);

        if (options.shadowColor) {
            ctx.shadowColor = options.shadowColor;
            ctx.shadowBlur = Number.isFinite(options.shadowBlur) ? options.shadowBlur : 0;
            ctx.shadowOffsetX = Number.isFinite(options.shadowOffsetX) ? options.shadowOffsetX : 0;
            ctx.shadowOffsetY = Number.isFinite(options.shadowOffsetY) ? options.shadowOffsetY : 0;
        }

        if (options.strokeColor) {
            ctx.lineWidth = Number.isFinite(options.strokeWidth) ? options.strokeWidth : 3;
            ctx.strokeStyle = options.strokeColor;
            ctx.strokeText(content, x, y);
        }

        ctx.fillStyle = options.color || '#ffffff';
        ctx.fillText(content, x, y);
        ctx.restore();
        return content;
    },

    drawWrappedText(ctx, text, x, y, options = {}) {
        const lines = FontUtil.wrapText(ctx, text, options.maxWidth, options);
        const lineHeight = Number.isFinite(options.lineHeight)
            ? options.lineHeight
            : (Number.isFinite(options.size) ? options.size + 4 : 18);

        for (let index = 0; index < lines.length; index += 1) {
            FontUtil.drawText(ctx, lines[index], x, y + index * lineHeight, options);
        }

        return lines;
    },
});
