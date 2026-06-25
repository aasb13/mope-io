const XRAY_PLAYER_OBJECT_TYPE = 0x02;

class XrayModule extends Module {
    constructor(config = {}) {
        const revealUnderwaterSetting = new BooleanSetting({
            name: 'Reveal Underwater',
            description: 'Shows players that are hidden while underwater or diving.',
            value: true,
        });
        const revealHolesSetting = new BooleanSetting({
            name: 'Reveal Hiding Holes',
            description: 'Shows players hidden inside hiding holes.',
            value: true,
        });

        super({
            key: 'xray',
            name: 'Xray',
            category: Category.RENDER,
            description: 'Reveals players hidden underwater or inside hiding holes.',
            settings: [revealUnderwaterSetting, revealHolesSetting],
        });

        this.win = config.win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        this.renderInjectUtil = null;
        this.renderHookRecord = null;
        this.renderHookInstallPromise = null;
        this.debugLogTimestamps = new Map();
        this.retryFrameId = 0;

        revealUnderwaterSetting.onChange = () => this.handleSettingChange();
        revealHolesSetting.onChange = () => this.handleSettingChange();
    }

    debugLog(key, message, details = null, throttleMs = 0) {
        debugLog({
            win: this.win,
            module: 'Xray',
            key,
            message,
            details,
            throttleMs,
            timestamps: this.debugLogTimestamps,
        });
    }

    isRevealUnderwaterEnabled() {
        const setting = this.getSetting('Reveal Underwater');
        return !setting || setting.getValue();
    }

    isRevealHolesEnabled() {
        const setting = this.getSetting('Reveal Hiding Holes');
        return !setting || setting.getValue();
    }

    shouldRevealEntity(entity) {
        if (!entity || typeof entity !== 'object') {
            return false;
        }

        const objectType = Number(entity.oType ?? entity.entityType);
        if (objectType !== XRAY_PLAYER_OBJECT_TYPE) {
            return false;
        }

        const revealUnderwater = this.isRevealUnderwaterEnabled()
            && Boolean(entity.flag_underWater || entity.flag_usingDiveAbility);
        const revealHoles = this.isRevealHolesEnabled()
            && Boolean(entity.flag_inHidingHole);

        return revealUnderwater || revealHoles;
    }

    scheduleRetryInstall() {
        if (!this.enabled || this.renderHookRecord || this.retryFrameId) {
            return;
        }

        const root = this.win || window;
        const raf = typeof root.requestAnimationFrame === 'function'
            ? root.requestAnimationFrame.bind(root)
            : null;
        if (!raf) {
            return;
        }

        this.retryFrameId = raf(() => {
            this.retryFrameId = 0;
            if (!this.enabled || this.renderHookRecord) {
                return;
            }

            this.ensureRenderHook();
        });
    }

    cancelRetryInstall() {
        if (!this.retryFrameId) {
            return;
        }

        const root = this.win || window;
        if (typeof root.cancelAnimationFrame === 'function') {
            root.cancelAnimationFrame(this.retryFrameId);
        }
        this.retryFrameId = 0;
    }

    ensureRenderHook() {
        if (this.renderHookRecord) {
            return true;
        }
        if (this.renderHookInstallPromise) {
            return false;
        }

        const root = this.win || window;
        const searchUtil = root.__mopEngineSearchUtil instanceof SearchUtil
            ? root.__mopEngineSearchUtil
            : null;
        if (!searchUtil) {
            this.debugLog('missing-search-util', 'Xray render hook skipped because SearchUtil is unavailable', null, 1000);
            this.scheduleRetryInstall();
            return false;
        }

        const injectUtil = this.renderInjectUtil instanceof InjectUtil
            ? this.renderInjectUtil
            : new InjectUtil(searchUtil);
        this.renderInjectUtil = injectUtil;

        const module = this;
        this.renderHookInstallPromise = searchUtil
            .primeWindow(root, { maxDepth: 4 })
            .then(() => {
                const entry = injectUtil.findFirstFunctionEntry(InjectUtil.RENDER_TARGETS.entityDraw);
                if (!entry) {
                    throw new Error('entityDraw entry not found');
                }

                module.renderHookRecord = injectUtil.install(entry, {
                    intercept(call) {
                        const entity = call.thisArg;
                        if (!module.shouldRevealEntity(entity)) {
                            return null;
                        }

                        const entityFlags = entity.flags && typeof entity.flags === 'object'
                            ? entity.flags
                            : null;
                        const originalState = {
                            flag_underWater: entity.flag_underWater,
                            flag_usingDiveAbility: entity.flag_usingDiveAbility,
                            flag_inHidingHole: entity.flag_inHidingHole,
                            underwaterA: entity.underwaterA,
                            flags_underWater: entityFlags ? entityFlags.flag_underWater : undefined,
                            flags_usingDiveAbility: entityFlags ? entityFlags.flag_usingDiveAbility : undefined,
                            flags_inHidingHole: entityFlags ? entityFlags.flag_inHidingHole : undefined,
                        };

                        entity.flag_underWater = false;
                        entity.flag_usingDiveAbility = false;
                        entity.flag_inHidingHole = false;
                        entity.underwaterA = 1;

                        if (entityFlags) {
                            entityFlags.flag_underWater = false;
                            entityFlags.flag_usingDiveAbility = false;
                            entityFlags.flag_inHidingHole = false;
                        }

                        try {
                            return {
                                cancel: true,
                                returnValue: call.original.apply(call.thisArg, call.args),
                            };
                        } finally {
                            entity.flag_underWater = originalState.flag_underWater;
                            entity.flag_usingDiveAbility = originalState.flag_usingDiveAbility;
                            entity.flag_inHidingHole = originalState.flag_inHidingHole;
                            entity.underwaterA = originalState.underwaterA;

                            if (entityFlags) {
                                entityFlags.flag_underWater = originalState.flags_underWater;
                                entityFlags.flag_usingDiveAbility = originalState.flags_usingDiveAbility;
                                entityFlags.flag_inHidingHole = originalState.flags_inHidingHole;
                            }
                        }
                    },
                });

                module.debugLog('render-hook-install', 'Installed Xray render hook', {
                    path: entry.path,
                }, 0);
            })
            .catch((error) => {
                module.debugLog('render-hook-install-failed', 'Failed to install Xray render hook', {
                    error: error instanceof Error ? error.message : String(error),
                }, 1000);
                module.scheduleRetryInstall();
            })
            .finally(() => {
                module.renderHookInstallPromise = null;
            });

        return false;
    }

    removeRenderHook() {
        this.cancelRetryInstall();

        if (this.renderHookRecord && this.renderInjectUtil) {
            this.renderInjectUtil.uninstall(this.renderHookRecord.entry.path);
        }

        this.renderHookRecord = null;
    }

    handleSettingChange() {
        if (this.enabled) {
            this.debugLog('settings-changed', 'Updated Xray visibility settings', {
                revealUnderwater: this.isRevealUnderwaterEnabled(),
                revealHoles: this.isRevealHolesEnabled(),
            }, 0);
        }
    }

    onEnable() {
        this.debugLog('module-enable', 'Xray module enabled', {
            revealUnderwater: this.isRevealUnderwaterEnabled(),
            revealHoles: this.isRevealHolesEnabled(),
        }, 0);
        this.ensureRenderHook();
    }

    onDisable() {
        this.debugLog('module-disable', 'Xray module disabled', null, 0);
        this.removeRenderHook();
    }

    destroy() {
        this.removeRenderHook();
    }
}
