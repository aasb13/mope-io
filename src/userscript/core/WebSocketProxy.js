function installWebSocketProxy(win) {
    const OriginalWebSocket = win.WebSocket;

    if (!OriginalWebSocket || OriginalWebSocket.__mopEngineInstalled) {
        return;
    }

    const WSProxy = new Proxy(OriginalWebSocket, {
        construct(target, args) {
            const ws = Reflect.construct(target, args);
            const originalSend = ws.send;

            win.__mopEngineDefaultWebSocket = ws;

            ws.send = function send(data) {
                let buffer = null;

                if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
                    buffer = PacketUtil.normalizePacketBuffer(data);
                    const packetEvent = emitSendPacket({ ws: this, buffer });

                    if (packetEvent.canceled) {
                        return undefined;
                    }

                    buffer = packetEvent.buffer;
                    packetEvent.parse();
                    processPacket('SENT', buffer);
                    return originalSend.call(this, buffer);
                }

                return originalSend.apply(this, arguments);
            };

            const handleReceiveBuffer = (buffer, nativeEvent, forceRedispatch = false) => {
                const packetEvent = emitReceivePacket({ ws, buffer, nativeEvent });

                if (packetEvent.canceled) {
                    if (nativeEvent && typeof nativeEvent.stopImmediatePropagation === 'function') {
                        nativeEvent.stopImmediatePropagation();
                    }
                    if (nativeEvent && typeof nativeEvent.preventDefault === 'function') {
                        nativeEvent.preventDefault();
                    }
                    return;
                }

                packetEvent.parse();
                processPacket('RECV', packetEvent.buffer);

                if ((packetEvent.buffer !== buffer || forceRedispatch) && nativeEvent) {
                    if (typeof nativeEvent.stopImmediatePropagation === 'function') {
                        nativeEvent.stopImmediatePropagation();
                    }
                    if (typeof nativeEvent.preventDefault === 'function') {
                        nativeEvent.preventDefault();
                    }

                    ws.__mopEngineDispatchingSyntheticMessage = true;
                    try {
                        ws.dispatchEvent(new MessageEvent('message', { data: packetEvent.buffer }));
                    } finally {
                        ws.__mopEngineDispatchingSyntheticMessage = false;
                    }
                }
            };

            ws.addEventListener('message', function onMessage(event) {
                if (ws.__mopEngineDispatchingSyntheticMessage) {
                    return;
                }

                if (event.data instanceof ArrayBuffer) {
                    handleReceiveBuffer(PacketUtil.normalizePacketBuffer(event.data), event);
                    return;
                }

                if (ArrayBuffer.isView(event.data)) {
                    handleReceiveBuffer(PacketUtil.normalizePacketBuffer(event.data), event);
                    return;
                }

                if (event.data instanceof Blob) {
                    if (typeof event.stopImmediatePropagation === 'function') {
                        event.stopImmediatePropagation();
                    }
                    if (typeof event.preventDefault === 'function') {
                        event.preventDefault();
                    }

                    const reader = new FileReader();
                    reader.onload = function onLoad() {
                        handleReceiveBuffer(PacketUtil.normalizePacketBuffer(reader.result), event, true);
                    };
                    reader.readAsArrayBuffer(event.data);
                }
            }, { capture: true });

            ws.addEventListener('close', function onClose() {
                if (win.__mopEngineDefaultWebSocket === ws) {
                    win.__mopEngineDefaultWebSocket = null;
                }
            });

            return ws;
        },
    });

    Object.defineProperty(WSProxy, '__mopEngineInstalled', {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
    });

    win.WebSocket = WSProxy;
}
