class World {
    constructor(config = {}) {
        this.win = config.win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        this.searchUtil = config.searchUtil || new SearchUtil();
        this.injectUtil = config.injectUtil || new InjectUtil(this.searchUtil);
        this.collections = null;
        this.resolvePromise = null;
    }

    async resolve(options = {}) {
        if (this.isReady()) {
            return this.collections;
        }

        if (this.resolvePromise) {
            return this.resolvePromise;
        }

        const win = options.win || this.win;
        const requestedDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 2;
        const candidateDepths = Array.from(new Set([
            requestedDepth,
            Math.max(requestedDepth, 3),
            Math.max(requestedDepth, 4),
        ]));

        const resolvePromise = (async () => {
            let bestCollections = null;
            let bestScore = -1;

            for (let index = 0; index < candidateDepths.length; index += 1) {
                const maxDepth = candidateDepths[index];
                const collections = await this.injectUtil.findWorldCollections({
                    win,
                    maxDepth,
                });
                const objectArray = Array.isArray(collections?.objectArray)
                    ? collections.objectArray
                    : null;
                const objectMap = collections?.objectMap && typeof collections.objectMap === 'object'
                    ? collections.objectMap
                    : null;
                const score = (objectArray ? objectArray.length : 0) + (objectMap ? Object.keys(objectMap).length : 0);

                if (score > bestScore) {
                    bestCollections = collections;
                    bestScore = score;
                }

                if (Array.isArray(objectArray) && objectArray.length > 0 && objectMap && Object.keys(objectMap).length > 0) {
                    this.collections = collections;
                    return collections;
                }
            }

            this.collections = bestCollections || {
                objectArrayEntry: null,
                objectMapEntry: null,
                objectArray: null,
                objectMap: null,
            };
            return this.collections;
        })();
        this.resolvePromise = resolvePromise;
        resolvePromise.finally(() => {
            if (this.resolvePromise === resolvePromise) {
                this.resolvePromise = null;
            }
        });

        return this.resolvePromise;
    }

    invalidate() {
        this.collections = null;
    }

    getObjectArray() {
        return this.collections && Array.isArray(this.collections.objectArray)
            ? this.collections.objectArray
            : null;
    }

    getObjectMap() {
        return this.collections && this.collections.objectMap && typeof this.collections.objectMap === 'object'
            ? this.collections.objectMap
            : null;
    }

    isReady() {
        const objectArray = this.getObjectArray();
        const objectMap = this.getObjectMap();
        return Boolean(
            Array.isArray(objectArray)
            && objectArray.length > 0
            && objectMap
            && Object.keys(objectMap).length > 0
        );
    }

    getObjects() {
        return this.getObjectArray() || [];
    }

    getObjectCount() {
        const objectArray = this.getObjectArray();
        return objectArray ? objectArray.length : 0;
    }

    getObject(index) {
        const objectArray = this.getObjectArray();
        if (!objectArray || !Number.isInteger(index) || index < 0) {
            return null;
        }

        return objectArray[index] || null;
    }

    getObjectById(id) {
        const objectMap = this.getObjectMap();
        const numericId = Number(id);
        if (objectMap && Number.isFinite(numericId)) {
            const mappedObject = objectMap[numericId];
            if (mappedObject) {
                return mappedObject;
            }
        }

        const objectArray = this.getObjectArray();
        if (!Array.isArray(objectArray) || !Number.isFinite(numericId)) {
            return null;
        }

        for (let index = 0; index < objectArray.length; index += 1) {
            const object = objectArray[index];
            if (Number(object?.id) === numericId) {
                return object;
            }
        }

        return null;
    }

    snapshot() {
        const objectArray = this.getObjectArray();
        const objectMap = this.getObjectMap();
        return {
            ready: this.isReady(),
            objectCount: objectArray ? objectArray.length : 0,
            objectMapSize: objectMap ? Object.keys(objectMap).length : 0,
            objectArrayPath: this.collections && this.collections.objectArrayEntry
                ? this.collections.objectArrayEntry.path
                : null,
            objectMapPath: this.collections && this.collections.objectMapEntry
                ? this.collections.objectMapEntry.path
                : null,
        };
    }
}

function getWorld(win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) {
    const world = win && win.__mopEngineWorld;
    return world instanceof World ? world : null;
}

function scheduleWorldResolve(options = {}) {
    const {
        world = getWorld(options.win),
        reason = 'unknown',
        lastResolveAttemptAt = 0,
        minIntervalMs = 2000,
        debugLogger = null,
    } = options;

    if (!world || typeof world.resolve !== 'function') {
        return lastResolveAttemptAt;
    }

    const now = Date.now();
    if ((now - lastResolveAttemptAt) < minIntervalMs) {
        return lastResolveAttemptAt;
    }

    if (typeof world.invalidate === 'function') {
        world.invalidate();
    }

    world.resolve().catch(() => {});
    if (typeof debugLogger === 'function') {
        debugLogger('world-reresolve', 'Requested a fresh world resolution for Tracers', {
            reason,
        }, 1000);
    }

    return now;
}

function getUsableWorldObjects(options = {}) {
    const {
        world = getWorld(options.win),
        state = getPacketParserState(),
        debugLogger = null,
        onUnusable = null,
    } = options;

    const worldObjects = world && typeof world.getObjects === 'function'
        ? world.getObjects()
        : null;
    if (!Array.isArray(worldObjects) || worldObjects.length === 0) {
        return null;
    }

    const entityCount = state && state.entities && typeof state.entities === 'object'
        ? Object.keys(state.entities).length
        : 0;
    const localPlayerIds = [state?.playerId, state?.previousPlayerId];
    const packetPlayerCount = state && state.entities && typeof state.entities === 'object'
        ? scanPlayerTargets(state.entities, localPlayerIds).length
        : 0;
    const worldPlayerCount = scanPlayerTargetsFromWorld(worldObjects, localPlayerIds).length;
    const suspiciouslySmall = worldObjects.length <= 1 && entityCount > 10;
    const missingWorldPlayers = packetPlayerCount > 0
        && worldPlayerCount === 0
        && worldObjects.length < Math.max(4, packetPlayerCount);

    if (suspiciouslySmall || missingWorldPlayers) {
        if (typeof onUnusable === 'function') {
            onUnusable(world, suspiciouslySmall ? 'world-object-count-too-small' : 'world-player-count-mismatch');
        }
        if (typeof debugLogger === 'function') {
            debugLogger('world-unusable', 'Ignoring unusable world object snapshot for Tracers', {
                worldObjectCount: worldObjects.length,
                worldPlayerCount,
                packetPlayerCount,
                entityCount,
            }, 1000);
        }
        return null;
    }

    return worldObjects;
}
