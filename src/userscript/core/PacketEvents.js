const PACKET_EVENT_SEND = 'sendPacket';
const PACKET_EVENT_RECEIVE = 'receivePacket';
const PACKET_EVENT_ANY = 'packet';

function getPacketEventRoot() {
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

function normalizeListenerPriority(priority) {
    return Number.isFinite(priority) ? priority : Priority.NORMAL;
}

function setPacketListenerPriority(handler, priority) {
    if (typeof handler !== 'function') {
        throw new TypeError('Packet listener priority can only be applied to functions');
    }

    handler.__mopEnginePacketPriority = normalizeListenerPriority(priority);
    return handler;
}

function normalizeListenerOptions(optionsOrPriority, handler) {
    if (typeof optionsOrPriority === 'number') {
        return { priority: normalizeListenerPriority(optionsOrPriority) };
    }

    const options = optionsOrPriority && typeof optionsOrPriority === 'object'
        ? { ...optionsOrPriority }
        : {};

    if (!Object.prototype.hasOwnProperty.call(options, 'priority')) {
        options.priority = normalizeListenerPriority(handler && handler.__mopEnginePacketPriority);
    } else {
        options.priority = normalizeListenerPriority(options.priority);
    }

    return options;
}

class PacketEventBus {
    constructor() {
        this.listeners = {
            [PACKET_EVENT_ANY]: [],
            [PACKET_EVENT_SEND]: [],
            [PACKET_EVENT_RECEIVE]: [],
        };
        this.nextListenerId = 1;
    }

    on(eventName, handler, optionsOrPriority = Priority.NORMAL) {
        if (!this.listeners[eventName]) {
            throw new Error(`Unknown packet event: ${eventName}`);
        }

        if (typeof handler !== 'function') {
            throw new TypeError(`Packet event handler for ${eventName} must be a function`);
        }

        const options = normalizeListenerOptions(optionsOrPriority, handler);
        const listener = {
            id: this.nextListenerId++,
            handler,
            options,
            priority: options.priority,
        };

        this.listeners[eventName].push(listener);
        this.listeners[eventName].sort((left, right) => {
            if (right.priority !== left.priority) {
                return right.priority - left.priority;
            }

            return left.id - right.id;
        });

        return () => this.off(eventName, listener.id);
    }

    off(eventName, handlerOrId) {
        if (!this.listeners[eventName]) {
            return false;
        }

        const index = this.listeners[eventName].findIndex((listener) =>
            listener.id === handlerOrId || listener.handler === handlerOrId
        );

        if (index === -1) {
            return false;
        }

        this.listeners[eventName].splice(index, 1);
        return true;
    }

    matchesListener(listener, event) {
        const { options } = listener;
        const header = event.getHeader();
        const packetInfo = event.parse();
        const packet = packetInfo.parsedPacket;

        if (typeof options.direction === 'string' && options.direction !== event.direction) {
            return false;
        }

        if (typeof options.header === 'number' && options.header !== header) {
            return false;
        }

        if (Array.isArray(options.headers) && !options.headers.includes(header)) {
            return false;
        }

        if (typeof options.packetClass === 'function' && !(packet instanceof options.packetClass)) {
            return false;
        }

        if (typeof options.packetName === 'string' && (!packet || packet.packetName !== options.packetName)) {
            return false;
        }

        if (typeof options.predicate === 'function' && !options.predicate(event, packetInfo)) {
            return false;
        }

        return true;
    }

    emitSingleEvent(eventName, event) {
        for (const listener of this.listeners[eventName].slice()) {
            if (event.propagationStopped) {
                break;
            }

            if (!this.matchesListener(listener, event)) {
                continue;
            }

            try {
                listener.handler(event, event.parse());
            } catch (error) {
                event.errors.push(error);
                console.error(`Packet event handler failed for ${eventName}:`, error);
            }

            if (listener.options.once) {
                this.off(eventName, listener.id);
            }
        }
    }

    emit(eventName, payload) {
        if (!this.listeners[eventName]) {
            throw new Error(`Unknown packet event: ${eventName}`);
        }

        const event = payload instanceof PacketEvent
            ? payload
            : eventName === PACKET_EVENT_SEND
                ? new SendPacketEvent(payload)
                : eventName === PACKET_EVENT_RECEIVE
                    ? new ReceivePacketEvent(payload)
                    : new PacketEvent({ ...payload, name: eventName });

        if (eventName === PACKET_EVENT_SEND || eventName === PACKET_EVENT_RECEIVE) {
            this.emitSingleEvent(PACKET_EVENT_ANY, event);
        }

        this.emitSingleEvent(eventName, event);

        return event;
    }

    onPacket(handler, optionsOrPriority = Priority.NORMAL) {
        return this.on(PACKET_EVENT_ANY, handler, optionsOrPriority);
    }

    onSendPacket(handler, optionsOrPriority = Priority.NORMAL) {
        return this.on(PACKET_EVENT_SEND, handler, optionsOrPriority);
    }

    onReceivePacket(handler, optionsOrPriority = Priority.NORMAL) {
        return this.on(PACKET_EVENT_RECEIVE, handler, optionsOrPriority);
    }
}

function getPacketEventBus() {
    const root = getPacketEventRoot();
    if (!root) {
        throw new Error('Packet event root is unavailable');
    }

    if (!(root.__mopEnginePacketEventBus instanceof PacketEventBus)) {
        Object.defineProperty(root, '__mopEnginePacketEventBus', {
            value: new PacketEventBus(),
            configurable: true,
            enumerable: false,
            writable: true,
        });
    }

    return root.__mopEnginePacketEventBus;
}

function emitSendPacket(payload) {
    const event = new SendPacketEvent(payload);
    getGlobalEventManager().emit(event);
    return getPacketEventBus().emit(PACKET_EVENT_SEND, event);
}

function emitReceivePacket(payload) {
    const event = new ReceivePacketEvent(payload);
    getGlobalEventManager().emit(event);
    return getPacketEventBus().emit(PACKET_EVENT_RECEIVE, event);
}

function initPacketEvents(root) {
    const bus = getPacketEventBus();
    root.__mopEnginePacketEventBus = bus;
    root.PacketEventPriority = Priority;
    root.setPacketListenerPriority = setPacketListenerPriority;
    root.onPacket = function onPacket(handler, optionsOrPriority = Priority.NORMAL) {
        return bus.onPacket(handler, optionsOrPriority);
    };
    root.onSendPacket = function onSendPacket(handler, optionsOrPriority = Priority.NORMAL) {
        return bus.onSendPacket(handler, optionsOrPriority);
    };
    root.onReceivePacket = function onReceivePacket(handler, optionsOrPriority = Priority.NORMAL) {
        return bus.onReceivePacket(handler, optionsOrPriority);
    };
    root.offPacket = function offPacket(eventName, handlerOrId) {
        return bus.off(eventName, handlerOrId);
    };
    root.offSendPacket = function offSendPacket(handlerOrId) {
        return bus.off(PACKET_EVENT_SEND, handlerOrId);
    };
    root.offReceivePacket = function offReceivePacket(handlerOrId) {
        return bus.off(PACKET_EVENT_RECEIVE, handlerOrId);
    };
}
