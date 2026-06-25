function calculateMinimapLayout(options = {}) {
    const viewportWidth = Number(options.viewportWidth);
    const uiScale = Number.isFinite(options.uiScale) ? options.uiScale : 1;
    const scaleFactor = Number.isFinite(options.scaleFactor) ? options.scaleFactor : 1;
    const minimapWidth = Number(options.minimapWidth);
    const minimapHeight = Number(options.minimapHeight);
    const mapWidth = Number.isFinite(options.mapWidth) ? options.mapWidth : minimapWidth;
    const mapHeight = Number.isFinite(options.mapHeight) ? options.mapHeight : minimapHeight;

    if (![viewportWidth, minimapWidth, minimapHeight, mapWidth, mapHeight].every(Number.isFinite)) {
        return null;
    }

    // Reference: assets/deobf.js drawMap and minimap marker projection helpers.
    return {
        x: viewportWidth - (10 * uiScale + minimapWidth * scaleFactor),
        y: 10 * uiScale,
        width: mapWidth * scaleFactor,
        height: mapHeight * scaleFactor,
        uiScale,
        scaleFactor,
        minimapWidth,
        minimapHeight,
        mapWidth,
        mapHeight,
    };
}

function calculateMinimapObjectCircle(object, options = {}) {
    if (!object || typeof object !== 'object') {
        return null;
    }

    const scaleX = Number(options.scaleX);
    const scaleY = Number(options.scaleY);
    const objectScale = Number(options.objectScale);
    const x = Number(object.x);
    const y = Number(object.y);
    const radius = Number(object.r ?? object.rad ?? object.radius);
    if (![scaleX, scaleY, objectScale, x, y, radius].every(Number.isFinite) || objectScale === 0) {
        return null;
    }

    // Reference: assets/deobf.js _0x18979b.drawCircle.
    return {
        x: x * scaleX,
        y: y * scaleY,
        radius: Math.max(1, radius / objectScale),
        color: object.c ?? object.color ?? null,
    };
}

function calculateMinimapObjectRect(object, options = {}) {
    if (!object || typeof object !== 'object') {
        return null;
    }

    const scaleX = Number(options.scaleX);
    const scaleY = Number(options.scaleY);
    const x = Number(object.x);
    const y = Number(object.y);
    const width = Number(object.w ?? object.width);
    const height = Number(object.h ?? object.height);
    if (![scaleX, scaleY, x, y, width, height].every(Number.isFinite)) {
        return null;
    }

    // Reference: assets/deobf.js _0x18979b.drawRect.
    const scaledCenterX = x * scaleX;
    const scaledCenterY = y * scaleY;
    const scaledWidth = width * scaleX;
    const scaledHeight = height * scaleY;

    return {
        x: scaledCenterX - scaledWidth / 2,
        y: scaledCenterY - scaledHeight / 2,
        width: scaledWidth,
        height: scaledHeight,
        color: object.c ?? object.color ?? null,
    };
}

function projectWorldPointToMinimap(point, options = {}) {
    if (!point || typeof point !== 'object') {
        return null;
    }

    const layout = options.layout || calculateMinimapLayout(options);
    if (!layout) {
        return null;
    }

    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
    }

    return {
        x: layout.x + x * (layout.minimapWidth * layout.scaleFactor) / layout.mapWidth,
        y: layout.y + y * (layout.minimapHeight * layout.scaleFactor) / layout.mapHeight,
    };
}

function calculateMinimapMarkerRadius(radius, options = {}) {
    const uiScale = Number.isFinite(options.uiScale) ? options.uiScale : 1;
    const mapWidth = Number(options.mapWidth);
    const minimapWidth = Number(options.minimapWidth);
    const minimumRadius = Number.isFinite(options.minimumRadius) ? options.minimumRadius : 3;
    const entityRadius = Number(radius);

    if (![mapWidth, minimapWidth, entityRadius].every(Number.isFinite)) {
        return null;
    }

    return uiScale * Math.max(minimumRadius, entityRadius * (minimapWidth / mapWidth));
}

function projectEntityToMinimapMarker(entity, options = {}) {
    if (!entity || typeof entity !== 'object') {
        return null;
    }

    const point = projectWorldPointToMinimap(entity, options);
    const radius = calculateMinimapMarkerRadius(entity.rad ?? entity.radius, options);
    if (!point || radius == null) {
        return null;
    }

    return {
        x: point.x,
        y: point.y,
        radius,
    };
}

function getUI(module, createUI) {
    if (module?.ui) {
        return module.ui;
    }

    if (typeof createUI !== 'function') {
        return null;
    }

    module.ui = createUI();
    if (module.ui && module.enabled) {
        module.ui.attach();
        module.ui.setVisible(true);
    }

    return module.ui;
}

function handleDomReady(module, onReady) {
    if (!module || typeof module !== 'object') {
        return false;
    }

    module.pendingAttach = false;
    if (!module.enabled) {
        return false;
    }

    if (typeof onReady === 'function') {
        onReady();
    }

    return true;
}

function scheduleDomReadyAttach(module, listener, doc = document) {
    if (!module || typeof module !== 'object' || typeof listener !== 'function') {
        return false;
    }

    if (module.pendingAttach || doc.readyState !== 'loading') {
        return false;
    }

    module.pendingAttach = true;
    doc.addEventListener('DOMContentLoaded', listener, { once: true });
    return true;
}

function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
        return Number.isFinite(min) ? min : 0;
    }

    if (Number.isFinite(min) && value < min) {
        return min;
    }

    if (Number.isFinite(max) && value > max) {
        return max;
    }

    return value;
}

function pointInRect(x, y, rect) {
    if (!rect) {
        return false;
    }

    return x >= rect.x
        && y >= rect.y
        && x <= rect.x + rect.width
        && y <= rect.y + rect.height;
}

function roundRectPath(ctx, x, y, width, height, radius = 0) {
    const safeRadius = clamp(Number(radius) || 0, 0, Math.min(width, height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
}

function resolveColor(value, fallback = '#000000') {
    const sourceValue = value == null ? fallback : value;
    try {
        return Color.from(sourceValue).toCanvasStyle();
    } catch (error) {
        return Color.from(fallback).toCanvasStyle();
    }
}

function fillRoundedRect(ctx, x, y, width, height, radius = 0, color = '#000000') {
    ctx.save();
    ctx.fillStyle = resolveColor(color);
    roundRectPath(ctx, x, y, width, height, radius);
    ctx.fill();
    ctx.restore();
}

function strokeRoundedRect(ctx, x, y, width, height, radius = 0, color = '#000000', lineWidth = 1) {
    ctx.save();
    ctx.strokeStyle = resolveColor(color);
    ctx.lineWidth = lineWidth;
    roundRectPath(ctx, x, y, width, height, radius);
    ctx.stroke();
    ctx.restore();
}

function drawLine(ctx, x1, y1, x2, y2, options = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = resolveColor(options.color);
    ctx.lineWidth = Number.isFinite(options.lineWidth) ? options.lineWidth : 1;
    ctx.lineCap = options.lineCap || 'round';
    ctx.lineJoin = options.lineJoin || 'round';
    ctx.stroke();
    ctx.restore();
}

function drawCircle(ctx, x, y, radius, options = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);

    if (options.fill !== false) {
        ctx.fillStyle = resolveColor(options.color || options.fillStyle);
        ctx.fill();
    }

    if (options.strokeStyle) {
        ctx.strokeStyle = resolveColor(options.strokeStyle);
        ctx.lineWidth = Number.isFinite(options.lineWidth) ? options.lineWidth : 1;
        ctx.stroke();
    }

    ctx.restore();
}

function drawCheckbox(ctx, rect, checked, options = {}) {
    const radius = Number.isFinite(options.radius) ? options.radius : 6;
    fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, radius, options.backgroundColor || '#101826');
    strokeRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, radius, options.borderColor || '#4d607b', 1);

    if (!checked) {
        return;
    }

    const padding = Math.max(3, Math.floor(rect.width * 0.22));
    drawLine(
        ctx,
        rect.x + padding,
        rect.y + rect.height * 0.55,
        rect.x + rect.width * 0.45,
        rect.y + rect.height - padding,
        {
            color: options.checkColor || '#6ee7b7',
            lineWidth: 2,
        }
    );
    drawLine(
        ctx,
        rect.x + rect.width * 0.45,
        rect.y + rect.height - padding,
        rect.x + rect.width - padding,
        rect.y + padding,
        {
            color: options.checkColor || '#6ee7b7',
            lineWidth: 2,
        }
    );
}

function clearCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function resizeCanvasToDisplaySize(canvas, ctx) {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(window.innerWidth * ratio));
    const height = Math.max(1, Math.floor(window.innerHeight * ratio));

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: window.innerWidth, height: window.innerHeight, ratio };
}

function createOverlayCanvas(id, zIndex = 2147483646) {
    const existing = document.getElementById(id);
    if (existing) {
        existing.remove();
    }

    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.style.position = 'fixed';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = String(zIndex);
    canvas.style.pointerEvents = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.touchAction = 'none';
    const parent = document.body || document.documentElement || document.head;
    if (!parent) {
        return null;
    }

    parent.appendChild(canvas);
    return canvas;
}

function getMainGameCanvas(currentCanvas = null) {
    if (currentCanvas && currentCanvas.isConnected) {
        const rect = currentCanvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            return currentCanvas;
        }
    }

    const canvases = Array.from(document.querySelectorAll('canvas'));
    let bestCanvas = null;

    for (let index = 0; index < canvases.length; index += 1) {
        const canvas = canvases[index];
        if (!canvas || !canvas.isConnected || (canvas.id && canvas.id.startsWith('mop-engine-'))) {
            continue;
        }

        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            continue;
        }

        if (!bestCanvas || rect.width * rect.height > bestCanvas.rect.width * bestCanvas.rect.height) {
            bestCanvas = {
                canvas,
                rect,
            };
        }
    }

    return bestCanvas ? bestCanvas.canvas : null;
}

function captureCanvasProjection(canvas) {
    if (!canvas) {
        return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.getTransform !== 'function') {
        return null;
    }

    const transform = ctx.getTransform();
    if (!transform) {
        return null;
    }

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, canvas.width || Math.round(rect.width));
    const height = Math.max(1, canvas.height || Math.round(rect.height));
    return {
        matrix: {
            a: transform.a,
            b: transform.b,
            c: transform.c,
            d: transform.d,
            e: transform.e,
            f: transform.f,
        },
        scaleX: rect.width / width,
        scaleY: rect.height / height,
    };
}

function projectWorldPointToScreen(point, projection) {
    if (!point || typeof point !== 'object' || !projection) {
        return null;
    }

    const x = Number(point.x);
    const y = Number(point.y);
    if (![x, y].every(Number.isFinite)) {
        return null;
    }

    const matrix = projection.matrix;
    return {
        x: (x * matrix.a + y * matrix.c + matrix.e) * projection.scaleX,
        y: (x * matrix.b + y * matrix.d + matrix.f) * projection.scaleY,
    };
}

function projectWorldPointToScreenFromCamera(point, camera, options = {}) {
    if (!point || typeof point !== 'object' || !camera || typeof camera !== 'object') {
        return null;
    }

    const x = Number(point.x);
    const y = Number(point.y);
    const cameraX = Number(camera.x);
    const cameraY = Number(camera.y);
    const zoom = Number(camera.zoom);
    const viewportWidth = Number.isFinite(options.viewportWidth) ? options.viewportWidth : window.innerWidth;
    const viewportHeight = Number.isFinite(options.viewportHeight) ? options.viewportHeight : window.innerHeight;
    if (![x, y, cameraX, cameraY, zoom, viewportWidth, viewportHeight].every(Number.isFinite)) {
        return null;
    }

    return {
        x: x * zoom + (viewportWidth / 2 - cameraX * zoom),
        y: y * zoom + (viewportHeight / 2 - cameraY * zoom),
    };
}

function drawText(ctx, text, x, y, options = {}) {
    return FontUtil.drawText(ctx, text, x, y, options);
}

function drawWrappedText(ctx, text, x, y, options = {}) {
    return FontUtil.drawWrappedText(ctx, text, x, y, options);
}

const RenderUtil = Object.freeze({
    calculateMinimapLayout,
    calculateMinimapObjectCircle,
    calculateMinimapObjectRect,
    projectWorldPointToMinimap,
    calculateMinimapMarkerRadius,
    projectEntityToMinimapMarker,
    clamp,
    pointInRect,
    roundRectPath,
    fillRoundedRect,
    strokeRoundedRect,
    drawLine,
    drawCircle,
    drawCheckbox,
    clearCanvas,
    resizeCanvasToDisplaySize,
    createOverlayCanvas,
    getMainGameCanvas,
    captureCanvasProjection,
    projectWorldPointToScreen,
    projectWorldPointToScreenFromCamera,
    drawText,
    drawWrappedText,
    resolveColor,
});
