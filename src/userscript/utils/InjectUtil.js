class InjectUtil {
    constructor(searchUtil) {
        this.searchUtil = searchUtil || null;
        this.activeHooks = new Map();
    }

    static get RENDER_TARGETS() {
        return Object.freeze({
            minimapDrawMap: Object.freeze({
                id: 'minimapDrawMap',
                key: 'drawMap',
                pathIncludes: 'window',
                members: ['drawMap'],
                predicate(entry) {
                    return Array.isArray(entry.strings)
                        && entry.strings.includes('"brown"')
                        && entry.strings.includes('"gold"')
                        && entry.strings.includes('"burlywood"')
                        && entry.strings.includes('"orange"');
                },
            }),
            minimapObjects: Object.freeze({
                id: 'minimapObjects',
                key: 'drawObjects',
                members: ['drawRect', 'drawCircle'],
            }),
            entityDraw: Object.freeze({
                id: 'entityDraw',
                key: 'draw',
                members: ['moveUpdate', 'beforeCustomDraw', 'customDraw', 'drawHealthBar', 'afterCustomDraw'],
            }),
            entityChat: Object.freeze({
                id: 'entityChat',
                key: 'drawChat',
                members: ['fillText', 'strokeText'],
                strings: ['"10px Arial"'],
            }),
        });
    }

    setSearchUtil(searchUtil) {
        this.searchUtil = searchUtil || null;
        return this;
    }

    resolveEntry(target) {
        if (!target) {
            return null;
        }

        if (target.owner && typeof target.key !== 'undefined' && typeof target.value === 'function') {
            return target;
        }

        if (!this.searchUtil) {
            return null;
        }

        if (typeof target === 'string') {
            return this.searchUtil.getEntryByPath(target) || this.searchUtil.getEntryByHash(target) || null;
        }

        if (typeof target === 'function') {
            const signature = this.searchUtil.getFunctionSignature(target);
            if (!signature) {
                return null;
            }

            const entries = this.searchUtil.getEntriesBySignature(signature);
            return entries.find((entry) => entry.value === target) || entries[0] || null;
        }

        return null;
    }

    normalizeArgs(args) {
        if (Array.isArray(args)) {
            return args.slice();
        }

        if (args && typeof args.length === 'number') {
            return Array.from(args);
        }

        return [];
    }

    normalizeHookResponse(response, call) {
        if (!response) {
            return null;
        }

        const normalized = { ...response };

        if (typeof normalized.cancel !== 'boolean') {
            normalized.cancel = false;
        }

        if (Object.prototype.hasOwnProperty.call(normalized, 'args')) {
            normalized.args = this.normalizeArgs(normalized.args);
        }

        if (!Object.prototype.hasOwnProperty.call(normalized, 'returnValue')) {
            normalized.returnValue = call.defaultReturnValue;
        }

        return normalized;
    }

    runHook(hook, call) {
        if (!hook) {
            return null;
        }

        const handler = typeof hook.intercept === 'function'
            ? hook.intercept
            : hook.before;

        if (typeof handler !== 'function') {
            return null;
        }

        const response = handler(call);
        return this.normalizeHookResponse(response, call);
    }

    install(target, hook = {}) {
        const entry = this.resolveEntry(target);
        if (!entry) {
            throw new Error('InjectUtil.install could not resolve a function entry');
        }

        if (!entry.owner) {
            throw new Error(`InjectUtil.install could not resolve an owner for ${entry.path}`);
        }

        if (typeof entry.value !== 'function') {
            throw new Error(`InjectUtil.install expected a function at ${entry.path}`);
        }

        if (this.activeHooks.has(entry.path)) {
            this.uninstall(entry.path);
        }

        const injectUtil = this;
        const original = entry.value;
        const installedHook = hook && typeof hook === 'object' ? hook : {};
        const wrapped = function wrappedInjectedFunction(...incomingArgs) {
            const call = {
                args: incomingArgs.slice(),
                originalArgs: incomingArgs.slice(),
                thisArg: this,
                original,
                owner: entry.owner,
                key: entry.key,
                path: entry.path,
                defaultReturnValue: undefined,
            };

            const response = injectUtil.runHook(installedHook, call);
            if (response && Object.prototype.hasOwnProperty.call(response, 'args')) {
                call.args = response.args;
            }

            if (response && response.cancel) {
                return response.returnValue;
            }

            return original.apply(this, call.args);
        };

        try {
            Object.defineProperty(wrapped, 'name', {
                configurable: true,
                value: original.name || `injected_${String(entry.key)}`,
            });
        } catch (error) {
            // Ignore if the engine refuses to redefine the function name.
        }

        entry.owner[entry.key] = wrapped;
        entry.value = wrapped;

        const record = {
            entry,
            hook: installedHook,
            original,
            wrapped,
        };

        this.activeHooks.set(entry.path, record);
        return record;
    }

    uninstall(target) {
        const entry = this.resolveEntry(target);
        const path = entry ? entry.path : String(target);
        const record = this.activeHooks.get(path);

        if (!record) {
            return false;
        }

        record.entry.owner[record.entry.key] = record.original;
        record.entry.value = record.original;
        this.activeHooks.delete(record.entry.path);
        return true;
    }

    getHook(target) {
        const entry = this.resolveEntry(target);
        if (!entry) {
            return null;
        }

        return this.activeHooks.get(entry.path) || null;
    }

    listHooks() {
        return Array.from(this.activeHooks.values());
    }

    findFirstFunctionEntry(criteria) {
        if (!this.searchUtil) {
            return null;
        }

        const entries = this.searchUtil.findFunctions(criteria);
        return entries[0] || null;
    }

    findEntries(criteria = {}) {
        if (!this.searchUtil) {
            return [];
        }

        return this.searchUtil.findEntries(criteria);
    }

    isLikelyGameObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }

        const hasNumericId = Number.isFinite(value.id);
        const hasNumericType = Number.isFinite(value.oType);
        const hasDraw = typeof value.draw === 'function';
        const hasUpdate = typeof value.worldUpd_readMsgUpdate === 'function'
            || typeof value.removeFromTheGame === 'function'
            || typeof value.calculateZIndex === 'function';

        return hasNumericId && hasNumericType && hasDraw && hasUpdate;
    }

    scoreGameObjectArray(array, map = null) {
        if (!Array.isArray(array)) {
            return -1;
        }

        let score = 0;
        if (array.length > 0) {
            score += Math.min(50, array.length);
        }

        const sample = array.slice(0, Math.min(array.length, 12));
        for (let index = 0; index < sample.length; index += 1) {
            const object = sample[index];
            if (!this.isLikelyGameObject(object)) {
                return -1;
            }

            score += 20;
            if (map && map[String(object.id)] === object) {
                score += 25;
            }
        }

        return score;
    }

    scoreGameObjectMap(map) {
        if (!map || typeof map !== 'object' || Array.isArray(map)) {
            return -1;
        }

        const keys = Object.keys(map);
        if (!keys.length) {
            return 0;
        }

        let score = 0;
        const sampleKeys = keys.slice(0, Math.min(keys.length, 16));
        for (let index = 0; index < sampleKeys.length; index += 1) {
            const key = sampleKeys[index];
            if (!/^\d+$/.test(key)) {
                return -1;
            }

            const value = map[key];
            if (!this.isLikelyGameObject(value)) {
                return -1;
            }

            if (String(value.id) !== key) {
                return -1;
            }

            score += 20;
        }

        score += Math.min(50, keys.length);
        return score;
    }

    async findWorldCollections(options = {}) {
        if (!this.searchUtil) {
            throw new Error('InjectUtil.findWorldCollections requires a SearchUtil instance');
        }

        const win = options.win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 2;
        await this.searchUtil.primeWindow(win, { maxDepth });

        const arrayEntries = this.findEntries({
            type: 'array',
            pathIncludes: 'window',
            predicate(entry) {
                return entry.owner === win;
            },
        });
        const objectEntries = this.findEntries({
            type: 'object',
            pathIncludes: 'window',
            predicate(entry) {
                return entry.owner === win;
            },
        });

        let best = null;
        for (let arrayIndex = 0; arrayIndex < arrayEntries.length; arrayIndex += 1) {
            const arrayEntry = arrayEntries[arrayIndex];
            const arrayValue = arrayEntry.value;
            for (let objectIndex = 0; objectIndex < objectEntries.length; objectIndex += 1) {
                const mapEntry = objectEntries[objectIndex];
                const mapValue = mapEntry.value;
                const mapScore = this.scoreGameObjectMap(mapValue);
                if (mapScore < 0) {
                    continue;
                }

                const arrayScore = this.scoreGameObjectArray(arrayValue, mapValue);
                if (arrayScore < 0) {
                    continue;
                }

                const score = arrayScore + mapScore;
                if (!best || score > best.score) {
                    best = {
                        score,
                        objectArrayEntry: arrayEntry,
                        objectMapEntry: mapEntry,
                        objectArray: arrayValue,
                        objectMap: mapValue,
                    };
                }
            }
        }

        if (!best) {
            return {
                objectArrayEntry: null,
                objectMapEntry: null,
                objectArray: null,
                objectMap: null,
            };
        }

        return {
            objectArrayEntry: best.objectArrayEntry,
            objectMapEntry: best.objectMapEntry,
            objectArray: best.objectArray,
            objectMap: best.objectMap,
        };
    }

    async findRenderEntries(options = {}) {
        if (!this.searchUtil) {
            throw new Error('InjectUtil.findRenderEntries requires a SearchUtil instance');
        }

        const win = options.win || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
        const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 4;
        await this.searchUtil.primeWindow(win, { maxDepth });

        const targets = InjectUtil.RENDER_TARGETS;
        return {
            minimapDrawMap: this.findFirstFunctionEntry(targets.minimapDrawMap),
            minimapObjects: this.findFirstFunctionEntry(targets.minimapObjects),
            entityDraw: this.findFirstFunctionEntry(targets.entityDraw),
            entityChat: this.findFirstFunctionEntry(targets.entityChat),
        };
    }

    createRenderHook(userHook, meta) {
        if (!userHook || typeof userHook !== 'object') {
            return {};
        }

        return {
            intercept(call) {
                call.renderType = meta.renderType;
                call.renderName = meta.renderName;
                call.targetEntry = meta.entry;

                if (typeof userHook.intercept === 'function') {
                    return userHook.intercept(call);
                }

                if (typeof userHook.before === 'function') {
                    return userHook.before(call);
                }

                return null;
            },
        };
    }

    async installRenderHooks(hooks = {}, options = {}) {
        const entries = await this.findRenderEntries(options);
        const installed = {};

        const mapping = [
            ['minimapDrawMap', hooks.minimapDrawMap],
            ['minimapObjects', hooks.minimapObjects],
            ['entityDraw', hooks.entityDraw],
            ['entityChat', hooks.entityChat],
        ];

        for (const [name, userHook] of mapping) {
            const entry = entries[name];
            if (!entry || !userHook) {
                continue;
            }

            installed[name] = this.install(entry, this.createRenderHook(userHook, {
                entry,
                renderName: name,
                renderType: 'render',
            }));
        }

        return {
            entries,
            installed,
        };
    }
}
