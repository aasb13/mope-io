(function main() {
    'use strict';

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    if (win.top !== win.self) {
        return; // Skip execution in iframes
    }

    if (win.__mopEngineInitialized) {
        return;
    }
    win.__mopEngineInitialized = true;

    if (win.__mopEngineModuleManager && typeof win.__mopEngineModuleManager.destroy === 'function') {
        win.__mopEngineModuleManager.destroy();
    } else if (win.__mopEngineClickGUI && typeof win.__mopEngineClickGUI.destroy === 'function') {
        win.__mopEngineClickGUI.destroy();
    }

    const searchUtil = new SearchUtil();
    const world = new World({ win, searchUtil });

    const REAL_CONSOLE = (() => {
        try {
            if (document && document.documentElement) {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.documentElement.appendChild(iframe);
                const frameConsole = iframe.contentWindow.console;
                document.documentElement.removeChild(iframe);
                if (frameConsole && typeof frameConsole.log === 'function') {
                    return frameConsole;
                }
            }
        } catch (e) {}

        // Fallback to regular console
        return console;
    })();

    window.__mopEngineRealConsole = REAL_CONSOLE;
    win.__mopEngineDebugLogs = Array.isArray(win.__mopEngineDebugLogs) ? win.__mopEngineDebugLogs : [];
    win.__mopEngineDebugLog = function mopEngineDebugLog(module, key, message, details = {}) {
        win.__mopEngineDebugLogs.push({
            timestamp: new Date().toISOString(),
            module: String(module || 'Userscript'),
            key: String(key || 'info'),
            message: String(message || ''),
            details: details && typeof details === 'object' ? details : {},
        });

        if (win.__mopEngineDebugLogs.length > 1000) {
            win.__mopEngineDebugLogs.shift();
        }
    };
    win.__mopEngineDebugLog('Userscript', 'init', 'Real console captured successfully');

    win.__mopCapturedSkins = new Map();

    (function installSkinCaptureHooks() {
        const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;

        CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
            if (image && image.naturalWidth && image.naturalWidth > 30) {
                try {
                    const transform = this.getTransform();
                    const screenX = transform.e;
                    const screenY = transform.f;

                    const state = win.__mopEnginePacketState;
                    const camera = win.__mopEngineCamera;

                    if (state && camera && state.entities) {
                        const screenW = camera.screenWidth || 1;
                        const screenH = camera.screenHeight || 1;
                        let bestMatchId = null;
                        let bestDist = 50;

                        for (const id in state.entities) {
                            const ent = state.entities[id];
                            const entType = ent.entityType ?? ent.oType;
                            if (entType !== 0x02) continue;

                            const worldX = ent.x ?? ent.pos?.x;
                            const worldY = ent.y ?? ent.pos?.y;
                            if (worldX === undefined || worldY === undefined) continue;

                            const projX = (worldX - camera.x) * camera.zoom + screenW / 2;
                            const projY = (worldY - camera.y) * camera.zoom + screenH / 2;
                            const dist = Math.hypot(screenX - projX, screenY - projY);
                            if (dist < bestDist) {
                                bestDist = dist;
                                bestMatchId = Number(id);
                            }
                        }

                        if (bestMatchId !== null) {
                            win.__mopCapturedSkins.set(bestMatchId, image);
                        }
                    }
                } catch (e) {
                    // Skin capture error ignored
                }
            }
            return originalDrawImage.call(this, image, ...args);
        };
    })();

    (function installCameraCapture() {
        const originalRAF = win.requestAnimationFrame;
        if (originalRAF) {
            win.requestAnimationFrame = function(callback) {
                return originalRAF.call(this, function(timestamp) {
                    // Try to extract camera from canvas context during render
                    try {
                        const canvas = document.getElementById('gCanvas');
                        if (canvas) {
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                const transform = ctx.getTransform();
                                // This is an approximation; the real camera is likely stored elsewhere
                                // We'll rely on the existing camera variable if available.
                            }
                        }
                    } catch (e) {}
                    return callback.call(this, timestamp);
                });
            };
        }
    })();

    const eventManager = getGlobalEventManager();
    initEventSystem(win, eventManager);
    const moduleManager = new ModuleManager({ win, eventManager });
    const clickGUIModule = moduleManager.getModule('clickGUI');
    const player = new Player(() => getCurrentPlayerEntity());

    initPacketEvents(win);
    win.__mopEngineGetDefaultWebSocket = function getDefaultWebSocket() {
        return win.__mopEngineDefaultWebSocket || null;
    };
    win.__mopEngineSearchUtil = searchUtil;
    win.__mopEngineWorld = world;
    win.__mopEnginePlayer = player;
    win.__mopEngineEventManager = eventManager;
    win.__mopEngineModuleManager = moduleManager;
    Object.defineProperty(win, '__mopEnginePacketState', {
        configurable: true,
        enumerable: false,
        get() {
            return getPacketParserState();
        },
    });
    Object.defineProperty(win, '__mopEngineCamera', {
        configurable: true,
        enumerable: false,
        get() {
            const camera = getInterpolatedCameraState();
            if (!camera) {
                return null;
            }

            const canvas = document.getElementById('gCanvas');
            const pixelRatio = (win && Number.isFinite(win.devicePixelRatio)) ? win.devicePixelRatio : 1;
            const screenWidth = canvas && Number.isFinite(canvas.width)
                ? canvas.width / pixelRatio
                : (Number.isFinite(win.innerWidth) ? win.innerWidth : null);
            const screenHeight = canvas && Number.isFinite(canvas.height)
                ? canvas.height / pixelRatio
                : (Number.isFinite(win.innerHeight) ? win.innerHeight : null);

            return {
                ...camera,
                screenWidth,
                screenHeight,
            };
        },
    });
    Object.defineProperty(win, '__mopEngineClickGUI', {
        configurable: true,
        enumerable: false,
        get() {
            return clickGUIModule && typeof clickGUIModule.getUI === 'function'
                ? clickGUIModule.getUI()
                : null;
        },
    });
    win.__mopEngineGame = {
        getAnimalName,
        getAnimalInfo,
        getBiomeName,
        getBiomeInfo,
        getAbilityInfo,
        getAbilityImagePath,
        getObjectTypeName,
        getObjectVariantName,
        getPlayerAnimalRelations,
        getEntityPlayerRelations,
        getStoredEntity,
        getCurrentPlayerEntity,
        getPlayer() {
            return player;
        },
        getPacketParserState() {
            return getPacketParserStateSnapshot();
        },
        getSearchUtil() {
            return searchUtil;
        },
        getWorld() {
            return world;
        },
        getModuleManager() {
            return moduleManager;
        },
        getEventManager() {
            return eventManager;
        },
        getClickGUI() {
            return clickGUIModule && typeof clickGUIModule.getUI === 'function'
                ? clickGUIModule.getUI()
                : null;
        },
    };
    win.__mopEngineUserscriptLoaded = true;
    world.resolve().catch((error) => {
        if (typeof win.__mopEngineDebugLog === 'function') {
            win.__mopEngineDebugLog('Userscript', 'world-resolve-failed', 'World resolve failed', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        console.warn('World resolve failed:', error);
    });
    installWebSocketProxy(win);
})();
