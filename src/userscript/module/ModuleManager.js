class ModuleManager {
    constructor(config = {}) {
        this.win = config.win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        this.eventManager = config.eventManager instanceof EventManager
            ? config.eventManager
            : getGlobalEventManager();
        this.modules = [];
        this.moduleMap = Object.create(null);
        this.modulesByName = Object.create(null);
        this.modulesByCategory = Object.create(null);
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.registerDefaults();
        this.attach();
    }

    registerDefaults() {
        this.register(new AutoAttackModule());
        this.register(new AutoRespawnModule());
        this.register(new TracersModule({
            win: this.win,
        }));
        this.register(new XrayModule({
            win: this.win,
        }));
        this.register(new PacketLoggerModule());
        this.register(new ClickGUIModule({
            win: this.win,
            moduleManager: this,
        }));
    }

    attach() {
        document.addEventListener('keydown', this.boundKeyDown);
    }

    destroy() {
        document.removeEventListener('keydown', this.boundKeyDown);

        this.modules.forEach((module) => {
            if (typeof module.destroy === 'function') {
                module.destroy();
            }
        });
    }

    register(module) {
        if (!(module instanceof Module)) {
            throw new Error('Only Module instances can be registered.');
        }

        if (this.getModule(module.key)) {
            throw new Error(`Module key "${module.key}" is already registered.`);
        }

        if (this.getModuleByName(module.name)) {
            throw new Error(`Module "${module.name}" is already registered.`);
        }

        this.modules.push(module);
        if (typeof module.setEventManager === 'function') {
            module.setEventManager(this.eventManager);
        }
        this.moduleMap[module.key] = module;
        this.modulesByName[module.name.toLowerCase()] = module;

        if (!this.modulesByCategory[module.category]) {
            this.modulesByCategory[module.category] = [];
        }

        this.modulesByCategory[module.category].push(module);

        Object.defineProperty(this, module.key, {
            configurable: false,
            enumerable: true,
            writable: false,
            value: module,
        });

        return module;
    }

    getModules() {
        return this.modules.slice();
    }

    getModule(key) {
        return this.moduleMap[String(key || '')] || null;
    }

    getModulesByCategory(category) {
        const modules = this.modulesByCategory[category];
        return modules ? modules.slice() : [];
    }

    getModuleByName(name) {
        return this.modulesByName[String(name || '').toLowerCase()] || null;
    }

    getModulesByBind(bind) {
        const normalizedBind = Number(bind);
        if (!Number.isInteger(normalizedBind) || normalizedBind <= 0) {
            return [];
        }

        return this.modules.filter((module) => module.bind === normalizedBind);
    }

    toggleModule(key) {
        const module = this.getModule(key) || this.getModuleByName(key);
        if (!module) {
            return null;
        }

        module.toggle();
        return module;
    }

    handleKeyDown(event) {
        if (!event || event.repeat) {
            return;
        }

        const matches = this.modules.filter((module) => module.matchesKeyEvent(event));
        if (!matches.length) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        matches.forEach((module) => module.toggle());
    }
}
