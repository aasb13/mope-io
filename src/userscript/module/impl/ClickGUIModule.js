class ClickGUIModule extends Module {
    constructor(config = {}) {
        super({
            key: 'clickGUI',
            bind: 16,
            name: 'ClickGUI',
            category: Category.RENDER,
            description: 'Displays the module configuration UI.',
        });

        this.win = config.win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        this.moduleManager = config.moduleManager;
        if (!(this.moduleManager instanceof ModuleManager)) {
            throw new Error('ClickGUIModule requires a ModuleManager instance.');
        }

        this.ui = null;
        this.pendingAttach = false;
        this.syncingVisibility = false;
        this.boundDomReady = this.handleDomReady.bind(this);
        this.boundVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    getUI() {
        return getUI(this, () => {
            return new ClickGUI({
                win: this.win,
                moduleManager: this.moduleManager,
                onVisibilityChange: this.boundVisibilityChange,
            });
        });
    }

    handleDomReady() {
        handleDomReady(this, () => {
            this.setOpen(true);
        });
    }

    scheduleDomReadyAttach() {
        scheduleDomReadyAttach(this, this.boundDomReady);
    }

    matchesKeyEvent(event) {
        if (this.bind === 16) {
            return event
                && Number(event.keyCode) === this.bind
                && event.code === 'ShiftRight';
        }

        return super.matchesKeyEvent(event);
    }

    handleVisibilityChange(visible) {
        if (this.syncingVisibility || this.enabled === visible) {
            return;
        }

        if (visible) {
            this.enable();
            return;
        }

        this.disable();
    }

    setOpen(open) {
        const nextOpen = Boolean(open);
        this.syncingVisibility = true;
        try {
            if (nextOpen) {
                this.enable();
            } else {
                this.disable();
            }
        } finally {
            this.syncingVisibility = false;
        }

        return this.enabled;
    }

    toggle() {
        return this.setOpen(!this.enabled);
    }

    onEnable() {
        if (document.readyState === 'loading' && !document.body && !document.documentElement) {
            this.scheduleDomReadyAttach();
            return;
        }

        const ui = this.getUI();
        if (!ui.attached && !ui.attach()) {
            this.scheduleDomReadyAttach();
            return;
        }

        ui.setVisible(true);
    }

    onDisable() {
        if (this.ui) {
            this.ui.setVisible(false);
        }
    }

    destroy() {
        if (this.pendingAttach) {
            document.removeEventListener('DOMContentLoaded', this.boundDomReady);
            this.pendingAttach = false;
        }

        if (this.ui) {
            this.ui.destroy();
            this.ui = null;
        }
    }
}
