class TracersUI extends UI {
    constructor(config = {}) {
        super({
            win: config.win,
            canvasId: 'mop-engine-tracers',
            canvasZIndex: 2147483645,
            autoRender: true,
        });

        this.module = config.module;
        if (!(this.module instanceof TracersModule)) {
            throw new Error('TracersUI requires a TracersModule instance.');
        }
    }

    onRender() {
        this.module.renderTracers(this.ctx, this.canvas);
    }
}

const TRACER_COIN_OBJECT_TYPE = 0x84;
const TRACER_PLAYER_OBJECT_TYPE = 0x02;
const TRACER_HEALING_STONE_OBJECT_TYPE = 0x2e; // ObjectType.js: Healing Stone
const TRACER_PLAYER_COLOR_EDIBLE = '#90ee90';
const TRACER_PLAYER_COLOR_DANGEROUS = '#ff0000';
const TRACER_PLAYER_COLOR_EQUAL = '#006400';
const TRACER_PLAYER_MARKER_MIN_RADIUS = 8;
const TRACER_PLAYER_MARKER_MAX_RADIUS = 18;
const TRACER_PLAYER_MARKER_GAP = 6;
class TracersModule extends Module {
    constructor(config = {}) {
        const coinSetting = new BooleanSetting({
            name: 'Coins',
            description: 'Draw tracers to every visible coin.',
            value: true,
        });
        const crystalSetting = new BooleanSetting({
            name: 'Crystals',
            description: 'Draw tracers to every visible healing stone.',
            value: true,
        });
        const playerSetting = new BooleanSetting({
            name: 'Players',
            description: 'Draw tracers to every other player.',
            value: true,
        });

        super({
            key: 'tracers',
            name: 'Tracers',
            category: Category.RENDER,
            description: 'Draws tracers to coins, healing stones, and other players.',
            settings: [coinSetting, crystalSetting, playerSetting],
        });

        this.win = config.win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        this.ui = null;
        this.pendingAttach = false;
        this.cachedCoinTargets = [];
        this.cachedCrystalTargets = [];
        this.cachedPlayerTargets = [];
        this.boundDomReady = this.handleDomReady.bind(this);
        this.gameCanvas = null;
        this.gameContext = null;
        this.originalContextClearRect = null;
        this.hookedDrawTranslatePrototype = null;
        this.originalDrawTranslate = null;
        this.drawnScreenPositions = new Map();
        this.recentLiveObjectsById = new Map();
        this.resolvedPlayerSpritesById = new Map();
        this.debugLogTimestamps = new Map();
        this.renderInjectUtil = null;
        this.renderHookRecord = null;
        this.renderHookInstallPromise = null;
        this.lastWorldResolveAttemptAt = 0;

        this.debugLog('module-constructor', 'Tracers module constructor called');

        coinSetting.onChange = () => this.handleSettingChange();
        crystalSetting.onChange = () => this.handleSettingChange();
        playerSetting.onChange = () => this.handleSettingChange();
    }

    resetTracerState() {
        this.cachedCoinTargets = [];
        this.cachedCrystalTargets = [];
        this.cachedPlayerTargets = [];
        this.drawnScreenPositions.clear();
        this.recentLiveObjectsById.clear();
        this.resolvedPlayerSpritesById.clear();
        this.debugLogTimestamps.clear();
    }

    isDrawableImageSource(image) {
        if (!image || typeof image !== 'object') {
            return false;
        }

        const width = Number(image.naturalWidth || image.videoWidth || image.width);
        const height = Number(image.naturalHeight || image.videoHeight || image.height);
        return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    }

    getTracerFacingAngle(entity) {
        const facingAngle = this.win?.__mopEnginePlayer?.getEntityFacingAngle(entity);
        if (Number.isFinite(facingAngle)) {
            return facingAngle;
        }

        const fallbackAngle = getEntityAngleRadians(entity);
        return Number.isFinite(fallbackAngle) ? fallbackAngle : 0;
    }

    cloneTargetRecord(value) {
        if (!value || typeof value !== 'object') {
            return {};
        }

        return { ...value };
    }

    buildWorldTargetRecord(worldObject, packetEntity = null) {
        const base = this.cloneTargetRecord(packetEntity);
        const live = this.cloneTargetRecord(worldObject);
        const entityId = Number(
            packetEntity?.entityId
            ?? packetEntity?.id
            ?? worldObject?.entityId
            ?? worldObject?.id
        );
        const entityType = Number(
            packetEntity?.entityType
            ?? packetEntity?.oType
            ?? worldObject?.entityType
            ?? worldObject?.oType
        );
        const secondaryType = Number(
            packetEntity?.secondaryType
            ?? packetEntity?.animalType
            ?? worldObject?.secondaryType
            ?? worldObject?.animalType
        );

        const record = {
            ...live,
            ...base,
            entityId: Number.isFinite(entityId) ? entityId : null,
            entityType: Number.isFinite(entityType) ? entityType : null,
        };
        if (Number.isFinite(secondaryType)) {
            record.secondaryType = secondaryType;
        }
        if (!Number.isFinite(record.animalType) && Number.isFinite(secondaryType)) {
            record.animalType = secondaryType;
        }
        if (!record.skinName && typeof worldObject?.getSkinName === 'function') {
            try {
                record.skinName = worldObject.getSkinName();
            } catch (error) {}
        }

        return enrichEntityRecord(record);
    }

    debugLog(key, message, details = null, throttleMs = 0) {
        debugLog({
            win: this.win,
            module: 'Tracers',
            key,
            message,
            details,
            throttleMs,
            timestamps: this.debugLogTimestamps,
        });
    }

    getUI() {
        return getUI(this, () => {
            return new TracersUI({
                win: this.win,
                module: this,
            });
        });
    }

    handleDomReady() {
        handleDomReady(this, () => {
            this.enable();
        });
    }

    scheduleDomReadyAttach() {
        scheduleDomReadyAttach(this, this.boundDomReady);
    }

    getWorld() {
        return getWorld(this.win);
    }

    scheduleWorldResolve(world = this.getWorld(), reason = 'unknown') {
        this.lastWorldResolveAttemptAt = scheduleWorldResolve({
            world,
            reason,
            lastResolveAttemptAt: this.lastWorldResolveAttemptAt,
            debugLogger: (key, message, details, throttleMs) => this.debugLog(key, message, details, throttleMs),
        });
    }

    getUsableWorldObjects(world = this.getWorld(), state = getPacketParserState()) {
        return getUsableWorldObjects({
            world,
            state,
            debugLogger: (key, message, details, throttleMs) => this.debugLog(key, message, details, throttleMs),
            onUnusable: (nextWorld, reason) => this.scheduleWorldResolve(nextWorld, reason),
        });
    }

    ensureRenderSpriteHook() {
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
            return false;
        }

        const injectUtil = this.renderInjectUtil instanceof InjectUtil
            ? this.renderInjectUtil
            : new InjectUtil(searchUtil);
        this.renderInjectUtil = injectUtil;

        const CanvasContext = root.CanvasRenderingContext2D;
        if (!CanvasContext || !CanvasContext.prototype || typeof CanvasContext.prototype.drawImage !== 'function') {
            return false;
        }

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
                        const entityId = Number(entity?.id ?? entity?.entityId);
                        const objectType = Number(entity?.oType ?? entity?.entityType);
                        if (objectType !== TRACER_PLAYER_OBJECT_TYPE || !Number.isFinite(entityId)) {
                            return null;
                        }

                        const originalDrawImage = CanvasContext.prototype.drawImage;
                        const drawOps = [];

                        CanvasContext.prototype.drawImage = function patchedTracerDrawImage(...args) {
                            const image = args[0];
                            if (module.isDrawableImageSource(image) && image !== module.gameCanvas && typeof this.getTransform === 'function') {
                                const transform = this.getTransform();
                                drawOps.push({
                                    image,
                                    args: args.slice(1),
                                    alpha: Number.isFinite(this.globalAlpha) ? this.globalAlpha : 1,
                                    transform: {
                                        a: transform.a,
                                        b: transform.b,
                                        c: transform.c,
                                        d: transform.d,
                                        e: transform.e,
                                        f: transform.f,
                                    },
                                });
                            }

                            return originalDrawImage.apply(this, args);
                        };

                        try {
                            const returnValue = call.original.apply(call.thisArg, call.args);
                            const centerPoint = module.drawnScreenPositions.get(entityId) || null;
                            if (drawOps.length > 0 && centerPoint) {
                                module.resolvedPlayerSpritesById.set(entityId, {
                                    drawOps,
                                    centerX: centerPoint.x,
                                    centerY: centerPoint.y,
                                    screenRadius: Number.isFinite(entity?.rad) ? entity.rad : null,
                                    source: 'live-entity-draw',
                                });
                                module.recentLiveObjectsById.set(entityId, entity);
                            }

                            return {
                                cancel: true,
                                returnValue,
                            };
                        } finally {
                            CanvasContext.prototype.drawImage = originalDrawImage;
                        }
                    },
                });

                module.debugLog('render-hook-install', 'Installed Tracers render sprite capture hook', {
                    path: entry.path,
                }, 0);
            })
            .catch((error) => {
                module.debugLog('render-hook-install-failed', 'Failed to install Tracers render sprite capture hook', {
                    error: error instanceof Error ? error.message : String(error),
                }, 1000);
            })
            .finally(() => {
                module.renderHookInstallPromise = null;
            });

        return false;
    }

    syncGameProjectionHooks() {
        const nextCanvas = RenderUtil.getMainGameCanvas(this.gameCanvas);
        if (nextCanvas === this.gameCanvas && this.gameContext) {
            return;
        }

        this.detachGameHooks();
        this.gameCanvas = nextCanvas;
        if (!this.gameCanvas || typeof this.gameCanvas.getContext !== 'function') {
            return;
        }

        const ctx = this.gameCanvas.getContext('2d');
        if (!ctx || typeof ctx.clearRect !== 'function' || typeof ctx.getTransform !== 'function') {
            return;
        }

        this.gameContext = ctx;
        this.originalContextClearRect = ctx.clearRect.bind(ctx);

        ctx.clearRect = (...args) => {
            const [x, y, width, height] = args;
            if (x === 0 && y === 0 && width === this.gameCanvas.width && height === this.gameCanvas.height) {
                this.drawnScreenPositions.clear();
            }

            return this.originalContextClearRect(...args);
        };
        this.installDrawTranslateHook();
    }

    detachGameHooks() {
        if (this.renderHookRecord && this.renderInjectUtil) {
            this.renderInjectUtil.uninstall(this.renderHookRecord.entry.path);
        }

        this.renderHookRecord = null;
        if (this.gameContext && this.originalContextClearRect) {
            this.gameContext.clearRect = this.originalContextClearRect;
        }

        if (this.hookedDrawTranslatePrototype && this.originalDrawTranslate) {
            this.hookedDrawTranslatePrototype.drawTranslate = this.originalDrawTranslate;
        }

        this.hookedDrawTranslatePrototype = null;
        this.originalDrawTranslate = null;
        this.gameContext = null;
        this.gameCanvas = null;
        this.originalContextClearRect = null;
        this.resetTracerState();
    }

    installDrawTranslateHook() {
        const world = this.getWorld();
        const objects = world && typeof world.getObjects === 'function' ? world.getObjects() : null;
        if (!Array.isArray(objects) || objects.length === 0) {
            return;
        }

        const sampleObject = objects.find((object) => object && typeof object.drawTranslate === 'function');
        if (!sampleObject) {
            return;
        }

        let prototype = sampleObject;
        while (prototype && !Object.prototype.hasOwnProperty.call(prototype, 'drawTranslate')) {
            prototype = Object.getPrototypeOf(prototype);
        }

        if (!prototype || typeof prototype.drawTranslate !== 'function') {
            return;
        }

        if (this.hookedDrawTranslatePrototype === prototype) {
            return;
        }

        this.hookedDrawTranslatePrototype = prototype;
        this.originalDrawTranslate = prototype.drawTranslate;
        const module = this;
        prototype.drawTranslate = function (...args) {
            const result = module.originalDrawTranslate.apply(this, args);
            module.captureDrawnScreenPosition(this);
            return result;
        };
    }

    captureDrawnScreenPosition(object) {
        if (!this.enabled || !this.gameContext || !this.gameCanvas || !object || typeof object !== 'object') {
            return;
        }

        const entityId = Number(object.id ?? object.entityId);
        const objectType = Number(object.oType ?? object.entityType);
        if (!Number.isFinite(entityId) || (
            objectType !== TRACER_PLAYER_OBJECT_TYPE
            && objectType !== TRACER_COIN_OBJECT_TYPE
            && objectType !== TRACER_HEALING_STONE_OBJECT_TYPE
        )) {
            return;
        }

        const transform = this.gameContext.getTransform();
        if (!transform) {
            return;
        }

        const rect = this.gameCanvas.getBoundingClientRect();
        const width = Math.max(1, this.gameCanvas.width || Math.round(rect.width));
        const height = Math.max(1, this.gameCanvas.height || Math.round(rect.height));
        this.drawnScreenPositions.set(entityId, {
            x: transform.e * (rect.width / width),
            y: transform.f * (rect.height / height),
            liveObject: object,
        });
        this.recentLiveObjectsById.set(entityId, object);
    }

    resolveLiveWorldObject(entityId, world = this.getWorld()) {
        const numericId = Number(entityId);
        if (!Number.isFinite(numericId)) {
            return null;
        }

        const drawnScreenPoint = this.drawnScreenPositions.get(numericId);
        if (drawnScreenPoint?.liveObject) {
            return drawnScreenPoint.liveObject;
        }

        const recentLiveObject = this.recentLiveObjectsById.get(numericId);
        if (recentLiveObject) {
            return recentLiveObject;
        }

        if (world && typeof world.getObjectById === 'function') {
            const worldObject = world.getObjectById(numericId);
            if (worldObject) {
                return worldObject;
            }
        }

        const worldObjects = world && typeof world.getObjects === 'function'
            ? world.getObjects()
            : null;
        if (Array.isArray(worldObjects)) {
            for (let index = 0; index < worldObjects.length; index += 1) {
                const object = worldObjects[index];
                if (Number(object?.id) === numericId) {
                    return object;
                }
            }
        }

        return null;
    }

    mergeTargetsByEntityId(preferredTargets, fallbackTargets, projector = (value) => value) {
        const merged = [];
        const seenEntityIds = new Set();
        const appendUniqueTargets = (targets) => {
            if (!Array.isArray(targets)) {
                return;
            }

            for (let index = 0; index < targets.length; index += 1) {
                const projectedTarget = projector(targets[index]);
                const entityId = Number(projectedTarget?.entityId ?? projectedTarget?.id);
                if (!Number.isFinite(entityId) || seenEntityIds.has(entityId)) {
                    continue;
                }

                seenEntityIds.add(entityId);
                merged.push(projectedTarget);
            }
        };

        appendUniqueTargets(preferredTargets);
        appendUniqueTargets(fallbackTargets);
        return merged;
    }

    pruneTransientCaches(worldObjects = null) {
        if (!Array.isArray(worldObjects) || worldObjects.length === 0) {
            this.drawnScreenPositions.clear();
            this.recentLiveObjectsById.clear();
            this.resolvedPlayerSpritesById.clear();
            return;
        }

        const liveEntityIds = new Set();
        for (let index = 0; index < worldObjects.length; index += 1) {
            const entityId = Number(worldObjects[index]?.id);
            if (Number.isInteger(entityId) && entityId > 0) {
                liveEntityIds.add(entityId);
            }
        }

        for (const entityId of Array.from(this.drawnScreenPositions.keys())) {
            if (!liveEntityIds.has(entityId)) {
                this.drawnScreenPositions.delete(entityId);
            }
        }

        for (const entityId of Array.from(this.recentLiveObjectsById.keys())) {
            if (!liveEntityIds.has(entityId)) {
                this.recentLiveObjectsById.delete(entityId);
            }
        }

        for (const entityId of Array.from(this.resolvedPlayerSpritesById.keys())) {
            if (!liveEntityIds.has(entityId)) {
                this.resolvedPlayerSpritesById.delete(entityId);
            }
        }
    }

    refreshTracerTargets() {
        const state = getPacketParserState();
        const localPlayerIds = [
            state?.playerId,
            state?.previousPlayerId,
        ];
        const world = this.getWorld();
        const worldObjects = this.getUsableWorldObjects(world, state);
        const entities = state && state.entities && typeof state.entities === 'object'
            ? state.entities
            : null;
        const packetCoinTargets = entities ? scanCoinTargets(entities) : [];
        const packetCrystalTargets = entities ? scanHealingStoneTargets(entities) : [];
        const packetPlayerTargets = entities
            ? scanPlayerTargets(entities, localPlayerIds).map((entity) => enrichEntityRecord({ ...entity }))
            : [];

        if (Array.isArray(worldObjects) && worldObjects.length > 0) {
            this.pruneTransientCaches(worldObjects);
            const worldCoinTargets = scanCoinTargetsFromWorld(worldObjects);
            const worldCrystalTargets = scanHealingStoneTargetsFromWorld(worldObjects);
            const worldPlayerTargets = scanPlayerTargetsFromWorld(worldObjects, localPlayerIds)
                .map((object) => this.buildWorldTargetRecord(object, entities ? entities[object.id] : null));
            this.cachedCoinTargets = this.mergeTargetsByEntityId(worldCoinTargets, packetCoinTargets);
            this.cachedCrystalTargets = this.mergeTargetsByEntityId(worldCrystalTargets, packetCrystalTargets);
            this.cachedPlayerTargets = this.mergeTargetsByEntityId(worldPlayerTargets, packetPlayerTargets, (target) => {
                return enrichEntityRecord({ ...target });
            });
            this.debugLog('refresh-world', 'Refreshed tracer targets from world objects', {
                worldObjectCount: worldObjects.length,
                worldCoins: worldCoinTargets.length,
                worldCrystals: worldCrystalTargets.length,
                worldPlayers: worldPlayerTargets.length,
                packetCoins: packetCoinTargets.length,
                packetCrystals: packetCrystalTargets.length,
                packetPlayers: packetPlayerTargets.length,
                mergedCoins: this.cachedCoinTargets.length,
                mergedCrystals: this.cachedCrystalTargets.length,
                mergedPlayers: this.cachedPlayerTargets.length,
                playerId: state?.playerId ?? null,
            }, 1000);
            return;
        }

        if (!entities) {
            this.cachedCoinTargets = [];
            this.cachedCrystalTargets = [];
            this.cachedPlayerTargets = [];
            this.debugLog('refresh-empty', 'Tracer target refresh found no world objects and no packet entities', {
                hasWorld: Boolean(world),
                hasState: Boolean(state),
            }, 1000);
            return;
        }

        this.cachedCoinTargets = packetCoinTargets;
        this.cachedCrystalTargets = packetCrystalTargets;
        this.cachedPlayerTargets = packetPlayerTargets;
        this.debugLog('refresh-packets', 'Refreshed tracer targets from packet entities', {
            entityCount: Object.keys(entities).length,
            coins: this.cachedCoinTargets.length,
            crystals: this.cachedCrystalTargets.length,
            players: this.cachedPlayerTargets.length,
            playerId: state?.playerId ?? null,
        }, 1000);
    }

    hasActiveTracerSettings() {
        const coinsSetting = this.getSetting('Coins');
        const crystalsSetting = this.getSetting('Crystals');
        const playersSetting = this.getSetting('Players');
        return Boolean(
            (coinsSetting && coinsSetting.getValue())
            || (crystalsSetting && crystalsSetting.getValue())
            || (playersSetting && playersSetting.getValue())
        );
    }

    hasRenderableTargets() {
        const coinsSetting = this.getSetting('Coins');
        const crystalsSetting = this.getSetting('Crystals');
        const playersSetting = this.getSetting('Players');
        return Boolean(
            (coinsSetting && coinsSetting.getValue() && this.cachedCoinTargets.length > 0)
            || (crystalsSetting && crystalsSetting.getValue() && this.cachedCrystalTargets.length > 0)
            || (playersSetting && playersSetting.getValue() && this.cachedPlayerTargets.length > 0)
        );
    }

    handleSettingChange() {
        if (!this.enabled || !this.ui) {
            return;
        }

        this.ui.setVisible(this.hasActiveTracerSettings());
    }

    projectTargetToScreen(target, camera, viewportWidth, viewportHeight) {
        return RenderUtil.projectWorldPointToScreenFromCamera(target, camera, {
            viewportWidth,
            viewportHeight,
        });
    }

    getPlayerTracerColor(target) {
        const relations = getEntityPlayerRelations(target);
        const canEatTarget = relations.includes(PLAYER_RELATION_LABELS.edible);
        const targetCanEatPlayer = relations.includes(PLAYER_RELATION_LABELS.dangerous);

        if (canEatTarget && !targetCanEatPlayer) {
            return TRACER_PLAYER_COLOR_EDIBLE;
        }

        if (targetCanEatPlayer && !canEatTarget) {
            return TRACER_PLAYER_COLOR_DANGEROUS;
        }

        return TRACER_PLAYER_COLOR_EQUAL;
    }

    getLocalTracerStartPoint(camera, viewportWidth, viewportHeight, nowMs) {
        const localPlayer = getCurrentPlayerEntity();
        const localPlayerId = Number(localPlayer && (localPlayer.entityId ?? localPlayer.id));
        const drawnLocalPosition = Number.isFinite(localPlayerId)
            ? this.drawnScreenPositions.get(localPlayerId)
            : null;
        if (drawnLocalPosition) {
            return {
                x: drawnLocalPosition.x,
                y: drawnLocalPosition.y,
            };
        }

        const liveLocalPosition = getRenderableEntityPosition(localPlayer, nowMs, {
            requireLiveWorldObject: true,
            liveFallbackAllowed: false,
            liveObjectResolver: (entity) => this.resolveLiveWorldObject(entity.entityId),
        });
        if (liveLocalPosition) {
            return this.projectTargetToScreen(liveLocalPosition, camera, viewportWidth, viewportHeight);
        }

        return {
            x: viewportWidth / 2,
            y: viewportHeight / 2,
        };
    }

    getLocalPlayerScreenRadius(nowMs, camera) {
        return getLocalPlayerScreenRadius({
            nowMs,
            camera,
            resolveLiveWorldObject: (entityId) => this.resolveLiveWorldObject(entityId),
        });
    }

    getPlayerMarkerSprite(target, liveTargetObject = null) {
        const liveObject = liveTargetObject && typeof liveTargetObject === 'object' ? liveTargetObject : null;
        const entityId = Number(target && target.entityId);
        const cacheResolvedSprite = (sprite) => {
            if (!Number.isFinite(entityId) || !sprite) {
                return sprite;
            }
            this.resolvedPlayerSpritesById.set(entityId, sprite);
            return sprite;
        };

        // --- NEW: Check global captured skins cache (from canvas hook) ---
        const capturedImage = this.win.__mopCapturedSkins?.get(entityId);
        if (capturedImage && this.isDrawableImageSource(capturedImage)) {
            this.debugLog(`player-sprite-captured-${entityId}`, `Using canvas-captured skin for player ${entityId}`, {
                entityId,
                width: capturedImage.naturalWidth,
                height: capturedImage.naturalHeight,
            }, 2000);
            return cacheResolvedSprite({
                image: capturedImage,
                angle: this.getTracerFacingAngle(target),
                skinScale: 1.4705882352941178,
                source: 'canvas-captured',
            });
        }
        // --- END NEW ---

        const directRenderSprite = Number.isFinite(entityId)
            ? this.resolvedPlayerSpritesById.get(entityId)
            : null;
        if (Array.isArray(directRenderSprite?.drawOps) && directRenderSprite.drawOps.length > 0) {
            return directRenderSprite;
        }

        if (liveObject && !liveObject.loadedSkinImg && typeof liveObject.loadAnimalSkinImg === 'function') {
            try {
                liveObject.loadAnimalSkinImg();
            } catch (error) {}
        }

        const liveImage = liveObject && liveObject.loadedSkinImg;
        const liveWidth = Number(liveImage && (liveImage.naturalWidth || liveImage.width));
        const liveHeight = Number(liveImage && (liveImage.naturalHeight || liveImage.height));
        if (this.isDrawableImageSource(liveImage)) {
            this.debugLog(`player-sprite-live-${entityId}`, `Using live loadedSkinImg for player ${entityId}`, {
                entityId,
                naturalWidth: liveWidth,
                naturalHeight: liveHeight,
                complete: liveImage.complete === true,
                animalType: liveObject?.animalType ?? null,
                animalSpecies: liveObject?.animalSpecies ?? null,
            }, 5000);
            return cacheResolvedSprite({
                image: liveImage,
                angle: this.getTracerFacingAngle(liveObject),
                skinScale: Number.isFinite(liveObject.skinScale) ? liveObject.skinScale : 1.4705882352941178,
                source: 'live-loaded-skin',
            });
        }

        const cachedSprite = Number.isFinite(entityId)
            ? this.resolvedPlayerSpritesById.get(entityId)
            : null;
        if (cachedSprite?.image) {
            return {
                image: cachedSprite.image,
                angle: this.getTracerFacingAngle(liveObject || target),
                skinScale: Number.isFinite(cachedSprite.skinScale) ? cachedSprite.skinScale : 1.4705882352941178,
            };
        }

        this.debugLog(`player-sprite-missing-${entityId}`, `Failed to resolve player tracer sprite for player ${entityId}`, {
            entityId,
            target,
            liveObject: liveObject ? {
                id: liveObject.id ?? null,
                oType: liveObject.oType ?? null,
                animalType: liveObject.animalType ?? null,
                animalSpecies: liveObject.animalSpecies ?? null,
                animalSubSpecies: liveObject.animalSubSpecies ?? null,
                skinScale: liveObject.skinScale ?? null,
                hasLoadedSkinImg: Boolean(liveObject.loadedSkinImg),
                hasLoadAnimalSkinImg: typeof liveObject.loadAnimalSkinImg === 'function',
                hasGetSkinName: typeof liveObject.getSkinName === 'function',
                hasGetSkinImageObj: typeof liveObject.getSkinImageObj === 'function',
            } : null,
        }, 1500);
        return null;
    }

    renderFallbackPlayerMarker(ctx, target, markerX, markerY, markerRadius, tracerColor) {
        const label = typeof target?.animalName === 'string' && target.animalName.length > 0
            ? target.animalName[0].toUpperCase()
            : '?';

        ctx.save();
        ctx.beginPath();
        ctx.arc(markerX, markerY, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 10, 10, 0.78)';
        ctx.shadowColor = tracerColor;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = tracerColor;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(10, Math.round(markerRadius * 1.15))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, markerX, markerY + 0.5);
        ctx.restore();
    }

    renderPlayerTracerMarker(ctx, target, targetScreenPoint, startPoint, camera, world, nowMs) {
        if (!targetScreenPoint || !startPoint || !camera) {
            return;
        }

        const dx = targetScreenPoint.x - startPoint.x;
        const dy = targetScreenPoint.y - startPoint.y;
        const distance = Math.hypot(dx, dy);
        if (!Number.isFinite(distance) || distance <= 0.001) {
            this.debugLog(`player-marker-distance-${target.entityId}`, `Skipping player tracer marker due to invalid distance for player ${target.entityId}`, {
                entityId: target.entityId,
                startPoint,
                targetScreenPoint,
                distance,
            });
            return;
        }

        const liveTargetObject = this.resolveLiveWorldObject(target.entityId, world);
        const targetRadius = getEntityRadius(liveTargetObject) ?? getEntityRadius(target);
        const sprite = this.getPlayerMarkerSprite(target, liveTargetObject);

        const markerRadius = Number.isFinite(targetRadius) && Number.isFinite(camera.zoom)
            ? clampNumber(targetRadius * camera.zoom * 0.22, TRACER_PLAYER_MARKER_MIN_RADIUS, TRACER_PLAYER_MARKER_MAX_RADIUS)
            : TRACER_PLAYER_MARKER_MIN_RADIUS;
        const localRadius = this.getLocalPlayerScreenRadius(nowMs, camera);
        const minimumOffset = markerRadius;
        const maximumOffset = distance - markerRadius;
        const preferredOffset = localRadius + markerRadius + TRACER_PLAYER_MARKER_GAP;
        const offset = maximumOffset <= minimumOffset
            ? distance * 0.5
            : clampNumber(preferredOffset, minimumOffset, maximumOffset);
        if (!Number.isFinite(offset) || offset <= 0) {
            this.debugLog(`player-marker-offset-${target.entityId}`, `Skipping player tracer marker due to invalid offset for player ${target.entityId}`, {
                entityId: target.entityId,
                distance,
                markerRadius,
                localRadius,
                offset,
            });
            return;
        }

        const markerX = startPoint.x + dx * (offset / distance);
        const markerY = startPoint.y + dy * (offset / distance);
        const tracerColor = this.getPlayerTracerColor(target);
        if (!sprite || (!sprite.image && (!Array.isArray(sprite.drawOps) || sprite.drawOps.length === 0))) {
            this.debugLog(`player-marker-no-sprite-${target.entityId}`, `No sprite resolved for player ${target.entityId}; skipping marker until the skin is ready`, {
                entityId: target.entityId,
                markerX,
                markerY,
                markerRadius,
                hasLiveTargetObject: Boolean(liveTargetObject),
            }, 1000);
            this.renderFallbackPlayerMarker(ctx, target, markerX, markerY, markerRadius, tracerColor);
            return;
        }

        this.debugLog(`player-marker-draw-${target.entityId}`, `Drawing player tracer sprite for player ${target.entityId}`, {
            entityId: target.entityId,
            drawOps: Array.isArray(sprite.drawOps) ? sprite.drawOps.length : 0,
            hasImage: this.isDrawableImageSource(sprite.image),
            angle: sprite.angle,
            markerX,
            markerY,
            markerRadius,
            tracerColor,
        }, 5000);
        if (Array.isArray(sprite.drawOps) && sprite.drawOps.length > 0) {
            const actualScreenRadius = Number.isFinite(targetRadius) && Number.isFinite(camera.zoom)
                ? Math.max(targetRadius * camera.zoom, 0.0001)
                : Math.max(markerRadius, 0.0001);
            const scaleFactor = markerRadius / actualScreenRadius;

            ctx.save();
            ctx.shadowColor = tracerColor;
            ctx.shadowBlur = 6;
            for (let index = 0; index < sprite.drawOps.length; index += 1) {
                const op = sprite.drawOps[index];
                if (!this.isDrawableImageSource(op?.image) || !op?.transform || !Array.isArray(op.args)) {
                    continue;
                }

                ctx.save();
                ctx.globalAlpha *= Number.isFinite(op.alpha) ? op.alpha : 1;
                ctx.setTransform(
                    op.transform.a * scaleFactor,
                    op.transform.b * scaleFactor,
                    op.transform.c * scaleFactor,
                    op.transform.d * scaleFactor,
                    markerX + (op.transform.e - sprite.centerX) * scaleFactor,
                    markerY + (op.transform.f - sprite.centerY) * scaleFactor
                );
                ctx.drawImage(op.image, ...op.args);
                ctx.restore();
            }
            ctx.restore();
            return;
        }

        const imageWidth = Number(sprite.image.naturalWidth || sprite.image.width || 64);
        const imageHeight = Number(sprite.image.naturalHeight || sprite.image.height || imageWidth);
        const aspectRatio = imageHeight / imageWidth;
        const drawWidth = markerRadius * 2.6;
        const drawHeight = drawWidth * aspectRatio;
        const angle = Number.isFinite(sprite.angle) ? sprite.angle : 0;

        ctx.save();
        ctx.translate(markerX, markerY);
        ctx.rotate(angle);
        ctx.shadowColor = tracerColor;
        ctx.shadowBlur = 6;
        ctx.drawImage(sprite.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
    }

    renderTracers(ctx, canvas) {
        if (!this.hasActiveTracerSettings()) {
            this.debugLog('render-disabled', 'Skipping tracer render because all tracer settings are disabled', null, 3000);
            return;
        }

        this.refreshTracerTargets();
        if (!this.hasRenderableTargets()) {
            this.drawnScreenPositions.clear();
            this.debugLog('render-no-targets', 'Skipping tracer render because no tracer targets are currently renderable', {
                coins: this.cachedCoinTargets.length,
                crystals: this.cachedCrystalTargets.length,
                players: this.cachedPlayerTargets.length,
            }, 1000);
            return;
        }

        const nowMs = Date.now();
        const camera = getInterpolatedCameraState(undefined, nowMs);
        if (!camera) {
            this.debugLog('render-no-camera', 'Skipping tracer render because camera state is unavailable', null, 1000);
            return;
        }

        this.syncGameProjectionHooks();
        this.ensureRenderSpriteHook();
        const world = this.getWorld();
        if (world && typeof world.isReady === 'function' && !world.isReady() && typeof world.resolve === 'function') {
            world.resolve().catch(() => {});
        }
        const requireLiveWorldObject = Boolean(this.getUsableWorldObjects(world));
        const pixelRatio = (this.win && this.win.devicePixelRatio) || 1;
        const viewportWidth = canvas.width / pixelRatio;
        const viewportHeight = canvas.height / pixelRatio;
        const startPoint = this.getLocalTracerStartPoint(camera, viewportWidth, viewportHeight, nowMs);
        const startX = startPoint.x;
        const startY = startPoint.y;

        const coinsSetting = this.getSetting('Coins');
        if (coinsSetting && coinsSetting.getValue()) {
            for (let index = 0; index < this.cachedCoinTargets.length; index += 1) {
                const target = this.cachedCoinTargets[index];
                const drawnScreenPoint = this.drawnScreenPositions.get(target.entityId);
                if (drawnScreenPoint) {
                    RenderUtil.drawLine(ctx, startX, startY, drawnScreenPoint.x, drawnScreenPoint.y, {
                        color: '#ffff00',
                        lineWidth: 1.5,
                    });
                    continue;
                }

                const position = getRenderableEntityPosition(target, nowMs, {
                    requireLiveWorldObject,
                    liveFallbackAllowed: !requireLiveWorldObject,
                    liveObjectResolver: (entity) => {
                        return this.resolveLiveWorldObject(entity.entityId, world);
                    },
                });
                if (position) {
                    const screenPoint = this.projectTargetToScreen(position, camera, viewportWidth, viewportHeight);
                    if (screenPoint) {
                        RenderUtil.drawLine(ctx, startX, startY, screenPoint.x, screenPoint.y, {
                            color: '#ffff00',
                            lineWidth: 1.5,
                        });
                    }
                }
            }
        }

        const crystalsSetting = this.getSetting('Crystals');
        if (crystalsSetting && crystalsSetting.getValue()) {
            for (let index = 0; index < this.cachedCrystalTargets.length; index += 1) {
                const target = this.cachedCrystalTargets[index];
                const drawnScreenPoint = this.drawnScreenPositions.get(target.entityId);
                if (drawnScreenPoint) {
                    RenderUtil.drawLine(ctx, startX, startY, drawnScreenPoint.x, drawnScreenPoint.y, {
                        color: '#ff69b4',
                        lineWidth: 1.5,
                    });
                    continue;
                }

                const position = getRenderableEntityPosition(target, nowMs, {
                    requireLiveWorldObject,
                    liveFallbackAllowed: !requireLiveWorldObject,
                    liveObjectResolver: (entity) => {
                        return this.resolveLiveWorldObject(entity.entityId, world);
                    },
                });
                if (position) {
                    const screenPoint = this.projectTargetToScreen(position, camera, viewportWidth, viewportHeight);
                    if (screenPoint) {
                        RenderUtil.drawLine(ctx, startX, startY, screenPoint.x, screenPoint.y, {
                            color: '#ff69b4',
                            lineWidth: 1.5,
                        });
                    }
                }
            }
        }

        const playersSetting = this.getSetting('Players');
        if (playersSetting && playersSetting.getValue()) {
            for (let index = 0; index < this.cachedPlayerTargets.length; index += 1) {
                const target = this.cachedPlayerTargets[index];
                const tracerColor = this.getPlayerTracerColor(target);
                const drawnScreenPoint = this.drawnScreenPositions.get(target.entityId);
                this.debugLog(`player-tracer-loop-${target.entityId}`, `Player tracer loop reached player ${target.entityId}`, {
                    entityId: target.entityId,
                    hasDrawnScreenPoint: Boolean(drawnScreenPoint),
                    tracerColor,
                    target,
                }, 1500);
                if (drawnScreenPoint) {
                    RenderUtil.drawLine(ctx, startX, startY, drawnScreenPoint.x, drawnScreenPoint.y, {
                        color: tracerColor,
                        lineWidth: 1.75,
                    });
                    this.renderPlayerTracerMarker(
                        ctx,
                        target,
                        drawnScreenPoint,
                        startPoint,
                        camera,
                        {
                            getObjectById: (entityId) => {
                                return this.resolveLiveWorldObject(entityId, world);
                            },
                        },
                        nowMs
                    );
                    continue;
                }

                const position = getRenderableEntityPosition(target, nowMs, {
                    requireLiveWorldObject,
                    liveFallbackAllowed: !requireLiveWorldObject,
                    liveObjectResolver: (entity) => {
                        return this.resolveLiveWorldObject(entity.entityId, world);
                    },
                });
                if (position) {
                    const screenPoint = this.projectTargetToScreen(position, camera, viewportWidth, viewportHeight);
                    if (screenPoint) {
                        RenderUtil.drawLine(ctx, startX, startY, screenPoint.x, screenPoint.y, {
                            color: tracerColor,
                            lineWidth: 1.75,
                        });
                        this.renderPlayerTracerMarker(ctx, target, screenPoint, startPoint, camera, world, nowMs);
                    }
                }
            }
        }
    }

    onEnable() {
        this.debugLog('module-enable', 'Tracers module enabled', {
            hasUI: Boolean(this.ui),
            readyState: document.readyState,
        }, 0);
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
        this.syncGameProjectionHooks();
        this.ensureRenderSpriteHook();
        const world = this.getWorld();
        if (world && typeof world.resolve === 'function') {
            world.resolve().then(() => {
                if (!this.enabled) {
                    return;
                }

                this.refreshTracerTargets();
            }).catch(() => {});
        }
        this.refreshTracerTargets();
        this.handleSettingChange();
    }

    onDisable() {
        this.detachGameHooks();
        if (this.ui) {
            this.ui.setVisible(false);
            this.ui.render();
        }
    }

    destroy() {
        if (this.pendingAttach) {
            document.removeEventListener('DOMContentLoaded', this.boundDomReady);
            this.pendingAttach = false;
        }

        this.detachGameHooks();
        if (this.ui) {
            this.ui.destroy();
            this.ui = null;
        }
    }

    onReceivePacket(event) {
        if (!this.enabled || !event || event.getHeader() !== 0x04) {
            return;
        }

        const packetInfo = typeof event.parse === 'function' ? event.parse() : null;
        const parsedPacket = packetInfo?.parsedPacket || null;
        if (packetInfo?.parsingError || parsedPacket?.parseWarning) {
            this.debugLog('packet-04-skip-invalid', 'Skipping tracer refresh for malformed entity update packet', {
                parsingError: packetInfo?.parsingError || null,
                parseWarning: parsedPacket?.parseWarning || null,
            }, 250);
            return;
        }

        this.debugLog('packet-04', 'Received entity update packet for Tracers refresh', null, 500);
        this.refreshTracerTargets();
        this.syncGameProjectionHooks();
        if (this.ui && this.ui.attached && this.ui.visible) {
            this.handleSettingChange();
        }
    }
}

EventTarget(
    ReceivePacketEvent,
    Priority.NORMAL
)(TracersModule.prototype, 'onReceivePacket', Object.getOwnPropertyDescriptor(TracersModule.prototype, 'onReceivePacket'));
