const EVENT_TARGET_METADATA_KEY = '__mopEngineEventTargets';

function normalizeEventPriority(priority) {
    return Number.isFinite(priority) ? priority : Priority.NORMAL;
}

function normalizeEventType(eventType) {
    if (eventType instanceof MopEvent) {
        return eventType.constructor;
    }

    if (typeof eventType === 'function' && (eventType === MopEvent || eventType.prototype instanceof MopEvent)) {
        return eventType;
    }

    throw new TypeError('Event target requires a MopEvent subclass or MopEvent instance.');
}

function getEventManagerRoot() {
    if (typeof unsafeWindow !== 'undefined') {
        return unsafeWindow;
    }

    if (typeof window !== 'undefined') {
        return window;
    }

    if (typeof globalThis !== 'undefined') {
        return globalThis;
    }

    return null;
}

function defineEventTargetMetadata(target, entry) {
    if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
        throw new TypeError('Event target metadata requires an object target.');
    }

    if (!Object.prototype.hasOwnProperty.call(target, EVENT_TARGET_METADATA_KEY)) {
        Object.defineProperty(target, EVENT_TARGET_METADATA_KEY, {
            value: [],
            configurable: true,
            enumerable: false,
            writable: true,
        });
    }

    target[EVENT_TARGET_METADATA_KEY].push(entry);
}

function EventTarget(eventType, priority = Priority.NORMAL, options = {}) {
    const normalizedEventType = normalizeEventType(eventType);
    const normalizedPriority = normalizeEventPriority(priority);

    return function applyEventTarget(target, propertyKey, descriptor) {
        const handler = descriptor && typeof descriptor.value === 'function'
            ? descriptor.value
            : target && typeof target[propertyKey] === 'function'
                ? target[propertyKey]
                : null;

        if (typeof propertyKey !== 'string' || !handler) {
            throw new TypeError('EventTarget can only decorate methods.');
        }

        defineEventTargetMetadata(target, {
            methodName: propertyKey,
            eventType: normalizedEventType,
            priority: normalizedPriority,
            once: Boolean(options.once),
        });

        return descriptor;
    };
}

function collectEventTargets(instance) {
    const targets = [];
    const seen = new Set();
    let prototype = Object.getPrototypeOf(instance);

    while (prototype && prototype !== Object.prototype) {
        const metadata = prototype[EVENT_TARGET_METADATA_KEY];
        if (Array.isArray(metadata)) {
            for (let index = 0; index < metadata.length; index += 1) {
                const entry = metadata[index];
                const key = `${entry.methodName}:${entry.eventType.name}:${entry.priority}:${entry.once}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    targets.push(entry);
                }
            }
        }

        prototype = Object.getPrototypeOf(prototype);
    }

    return targets;
}

class EventManager {
    constructor() {
        this.listeners = [];
        this.nextListenerId = 1;
    }

    on(eventType, handler, optionsOrPriority = Priority.NORMAL) {
        const normalizedEventType = normalizeEventType(eventType);
        if (typeof handler !== 'function') {
            throw new TypeError(`Event handler for ${normalizedEventType.name} must be a function.`);
        }

        const options = typeof optionsOrPriority === 'number'
            ? { priority: optionsOrPriority }
            : { ...(optionsOrPriority || {}) };
        const listener = {
            id: this.nextListenerId++,
            eventType: normalizedEventType,
            handler,
            priority: normalizeEventPriority(options.priority),
            once: Boolean(options.once),
        };

        this.listeners.push(listener);
        this.listeners.sort((left, right) => {
            if (right.priority !== left.priority) {
                return right.priority - left.priority;
            }

            return left.id - right.id;
        });

        return () => this.off(normalizedEventType, listener.id);
    }

    off(eventType, handlerOrId) {
        const normalizedEventType = normalizeEventType(eventType);
        const index = this.listeners.findIndex((listener) =>
            listener.eventType === normalizedEventType
            && (listener.id === handlerOrId || listener.handler === handlerOrId)
        );

        if (index === -1) {
            return false;
        }

        this.listeners.splice(index, 1);
        return true;
    }

    emit(event) {
        if (!(event instanceof MopEvent)) {
            throw new TypeError('EventManager.emit requires a MopEvent instance.');
        }

        const snapshot = this.listeners.slice();
        for (let index = 0; index < snapshot.length; index += 1) {
            const listener = snapshot[index];
            if (event.propagationStopped) {
                break;
            }

            if (!(event instanceof listener.eventType)) {
                continue;
            }

            try {
                listener.handler(event);
            } catch (error) {
                console.error(`Event handler failed for ${listener.eventType.name}:`, error);
            }

            if (listener.once) {
                this.off(listener.eventType, listener.id);
            }
        }

        return event;
    }

    registerObject(instance) {
        const targets = collectEventTargets(instance);
        return targets.map((target) => this.on(
            target.eventType,
            instance[target.methodName].bind(instance),
            {
                priority: target.priority,
                once: target.once,
            }
        ));
    }
}

function getGlobalEventManager() {
    const root = getEventManagerRoot();
    if (!root) {
        throw new Error('Event manager root is unavailable.');
    }

    if (!(root.__mopEngineEventManager instanceof EventManager)) {
        Object.defineProperty(root, '__mopEngineEventManager', {
            value: new EventManager(),
            configurable: true,
            enumerable: false,
            writable: true,
        });
    }

    return root.__mopEngineEventManager;
}

function initEventSystem(root, eventManager = getGlobalEventManager()) {
    root.__mopEngineEventManager = eventManager;
    root.MopEvent = MopEvent;
    root.MopEventManager = EventManager;
    root.MopEventTarget = EventTarget;
    root.MopPriority = Priority;
}
