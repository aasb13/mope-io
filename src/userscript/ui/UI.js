class UI {
    constructor(config = {}) {
        this.win = config.win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        this.canvasId = config.canvasId || '';
        this.canvasZIndex = Number.isFinite(config.canvasZIndex) ? config.canvasZIndex : 2147483646;
        this.autoRender = config.autoRender !== false;
        this.canvas = null;
        this.ctx = null;
        this.visible = false;
        this.attached = false;
        this.frameRequest = 0;

        this.boundResize = this.handleResize.bind(this);
        this.boundRenderLoop = this.renderLoop.bind(this);
    }

    ensureCanvas() {
        if (this.canvas && this.ctx) {
            return this.canvas;
        }

        if (!this.canvasId) {
            throw new Error('UI requires a canvasId to create an overlay canvas.');
        }

        this.canvas = RenderUtil.createOverlayCanvas(this.canvasId, this.canvasZIndex);
        if (!this.canvas) {
            return null;
        }

        this.ctx = this.canvas.getContext('2d');
        return this.canvas;
    }

    attach() {
        if (this.attached) {
            return false;
        }

        if (!this.ensureCanvas()) {
            return false;
        }

        this.attached = true;
        this.win.addEventListener('resize', this.boundResize);
        this.onAttach();
        this.handleResize();
        if (this.autoRender) {
            this.renderLoop();
        } else {
            this.render();
        }
        return true;
    }

    destroy() {
        if (this.attached) {
            this.win.removeEventListener('resize', this.boundResize);
            this.onDestroy();
            this.attached = false;
        }

        if (this.frameRequest) {
            this.win.cancelAnimationFrame(this.frameRequest);
            this.frameRequest = 0;
        }

        if (this.canvas) {
            this.canvas.remove();
        }

        this.canvas = null;
        this.ctx = null;
        this.visible = false;
    }

    setVisible(visible) {
        this.visible = Boolean(visible);
        if (!this.autoRender && this.attached) {
            this.render();
        }
        return this.visible;
    }

    toggle() {
        return this.setVisible(!this.visible);
    }

    handleResize() {
        if (this.canvas && this.ctx) {
            RenderUtil.resizeCanvasToDisplaySize(this.canvas, this.ctx);
        }

        this.onResize();
    }

    render() {
        if (!this.canvas || !this.ctx) {
            return;
        }

        RenderUtil.resizeCanvasToDisplaySize(this.canvas, this.ctx);
        RenderUtil.clearCanvas(this.ctx, this.canvas);

        if (!this.visible) {
            return;
        }

        this.onRender();
    }

    renderLoop() {
        this.render();
        if (this.attached) {
            this.frameRequest = this.win.requestAnimationFrame(this.boundRenderLoop);
        }
    }

    onAttach() {}

    onDestroy() {}

    onResize() {}

    onRender() {}
}
