class Module {
    constructor(config) {
        const {
            key = '',
            bind = 0,
            name,
            category,
            description = '',
            enabled = false,
            settings = [],
            eventManager = null,
        } = config || {};

        const normalizedKey = String(key || '').trim();
        const normalizedBind = Number(bind);
        if (!name) {
            throw new Error('Module requires a name.');
        }

        if (!normalizedKey) {
            throw new Error(`Module "${name}" requires a key.`);
        }

        if (!Number.isInteger(normalizedBind) || normalizedBind < 0) {
            throw new Error(`Module "${name}" has invalid bind "${bind}".`);
        }

        if (!Object.values(Category).includes(category)) {
            throw new Error(`Module "${name}" has invalid category "${category}".`);
        }

        this.key = normalizedKey;
        this.bind = normalizedBind;
        this.name = name;
        this.category = category;
        this.description = description;
        this.eventManager = eventManager instanceof EventManager ? eventManager : null;
        this.enabled = false;
        this.settings = [];
        this.eventSubscriptions = [];
        this.addSettings(settings);

        if (enabled) {
            this.enable();
        }
    }

    addSetting(setting) {
        if (!(setting instanceof Setting)) {
            throw new Error(`Module "${this.name}" can only register Setting instances.`);
        }

        const existingSetting = this.getSetting(setting.name);
        if (existingSetting) {
            throw new Error(`Module "${this.name}" already has setting "${setting.name}".`);
        }

        this.settings.push(setting.bindModule(this));
        return setting;
    }

    addSettings(settings) {
        settings.forEach((setting) => this.addSetting(setting));
        return this.settings;
    }

    getSetting(name) {
        const normalizedName = String(name || '').toLowerCase();
        return this.settings.find((setting) => setting.name.toLowerCase() === normalizedName) || null;
    }

    getSettings() {
        return this.settings.slice();
    }

    setBind(bind) {
        const normalizedBind = Number(bind);
        if (!Number.isInteger(normalizedBind) || normalizedBind < 0) {
            throw new Error(`Module "${this.name}" has invalid bind "${bind}".`);
        }

        this.bind = normalizedBind;
        return this.bind;
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager instanceof EventManager ? eventManager : null;
        if (this.enabled) {
            this.unbindEvents();
            this.bindEvents();
        }
        return this.eventManager;
    }

    bindEvents() {
        if (!(this.eventManager instanceof EventManager) || this.eventSubscriptions.length > 0) {
            return this.eventSubscriptions.slice();
        }

        this.eventSubscriptions = this.eventManager.registerObject(this);
        return this.eventSubscriptions.slice();
    }

    unbindEvents() {
        for (let index = 0; index < this.eventSubscriptions.length; index += 1) {
            const unsubscribe = this.eventSubscriptions[index];
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        }

        this.eventSubscriptions = [];
    }

    matchesKeyEvent(event) {
        if (!event || this.bind === 0) {
            return false;
        }

        return Number(event.keyCode) === this.bind;
    }

    setEnabled(enabled) {
        if (enabled) {
            this.enable();
            return;
        }

        this.disable();
    }

    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }

    enable() {
        if (this.enabled) {
            return false;
        }

        this.enabled = true;
        this.onEnable();
        this.bindEvents();
        if (this.eventManager instanceof EventManager) {
            this.eventManager.emit(new ModuleEnableEvent(this));
        }
        return true;
    }

    disable() {
        if (!this.enabled) {
            return false;
        }

        this.enabled = false;
        this.unbindEvents();
        this.onDisable();
        if (this.eventManager instanceof EventManager) {
            this.eventManager.emit(new ModuleDisableEvent(this));
        }
        return true;
    }

    onEnable() {}

    onDisable() {}
}
