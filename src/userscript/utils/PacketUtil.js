class PacketUtil {
    constructor(view, offset = 0) {
        this.view = view;
        this.offset = offset;
    }

    static getDefaultSocketRoot() {
        if (typeof unsafeWindow !== 'undefined') {
            return unsafeWindow;
        }

        if (typeof window !== 'undefined') {
            return window;
        }

        return null;
    }

    static getDefaultSocket() {
        const root = PacketUtil.getDefaultSocketRoot();
        if (!root) {
            return null;
        }

        if (typeof root.__mopEngineGetDefaultWebSocket === 'function') {
            return root.__mopEngineGetDefaultWebSocket();
        }

        return root.__mopEngineDefaultWebSocket || null;
    }

    static resolveSendInstance(instance) {
        const resolvedInstance = instance || PacketUtil.getDefaultSocket();
        if (!resolvedInstance || typeof resolvedInstance.send !== 'function') {
            throw new TypeError('sendPacket requires a websocket instance with a send function');
        }
        return resolvedInstance;
    }

    static resolveReceiveInstance(instance) {
        const resolvedInstance = instance || PacketUtil.getDefaultSocket();
        if (!resolvedInstance || typeof resolvedInstance.dispatchEvent !== 'function') {
            throw new TypeError('receivePacket requires a websocket instance with a dispatchEvent function');
        }
        return resolvedInstance;
    }

    static normalizePacketBuffer(packet) {
        if (packet instanceof ArrayBuffer) {
            return packet.slice(0);
        }

        if (ArrayBuffer.isView(packet)) {
            return packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
        }

        throw new TypeError('Packet must be an ArrayBuffer or an ArrayBuffer view');
    }

    static normalizePacket(packet) {
        // Accept a Packet instance (see utils/Packet.js) or a duck-typed equivalent.
        if (!packet || typeof packet !== 'object') {
            throw new TypeError('Packet must be a Packet instance');
        }

        const view = packet.view;
        if (!(view instanceof DataView)) {
            throw new TypeError('Packet must have a DataView at .view');
        }

        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }

    static sendPacket(packet, instance) {
        const buffer = PacketUtil.normalizePacket(packet);
        const resolvedInstance = PacketUtil.resolveSendInstance(instance);
        resolvedInstance.send(buffer);
        return buffer;
    }

    static receivePacket(packet, instance) {
        const buffer = PacketUtil.normalizePacket(packet);
        const resolvedInstance = PacketUtil.resolveReceiveInstance(instance);
        const messageEvent = new MessageEvent('message', { data: buffer });
        resolvedInstance.dispatchEvent(messageEvent);
        return buffer;
    }

    static sendPacketRaw(bufferLike, instance) {
        const buffer = PacketUtil.normalizePacketBuffer(bufferLike);
        const resolvedInstance = PacketUtil.resolveSendInstance(instance);
        resolvedInstance.send(buffer);
        return buffer;
    }

    static receivePacketRaw(bufferLike, instance) {
        const buffer = PacketUtil.normalizePacketBuffer(bufferLike);
        const resolvedInstance = PacketUtil.resolveReceiveInstance(instance);
        const messageEvent = new MessageEvent('message', { data: buffer });
        resolvedInstance.dispatchEvent(messageEvent);
        return buffer;
    }

    sendPacket(packet, instance) {
        return PacketUtil.sendPacket(packet, instance);
    }

    receivePacket(packet, instance) {
        return PacketUtil.receivePacket(packet, instance);
    }

    sendPacketRaw(bufferLike, instance) {
        return PacketUtil.sendPacketRaw(bufferLike, instance);
    }

    receivePacketRaw(bufferLike, instance) {
        return PacketUtil.receivePacketRaw(bufferLike, instance);
    }

    readUInt8() {
        if (this.offset + 1 > this.view.byteLength) {
            throw new RangeError('readUInt8 out of bounds');
        }
        return this.view.getUint8(this.offset++);
    }

    readUInt16() {
        if (this.offset + 2 > this.view.byteLength) {
            throw new RangeError('readUInt16 out of bounds');
        }
        const value = this.view.getUint16(this.offset, false);
        this.offset += 2;
        return value;
    }

    readUInt32() {
        if (this.offset + 4 > this.view.byteLength) {
            throw new RangeError('readUInt32 out of bounds');
        }
        const value = this.view.getUint32(this.offset, false);
        this.offset += 4;
        return value;
    }

    readInt16() {
        if (this.offset + 2 > this.view.byteLength) {
            throw new RangeError('readInt16 out of bounds');
        }
        const value = this.view.getInt16(this.offset, false);
        this.offset += 2;
        return value;
    }

    readString() {
        const length = this.readUInt16();
        let out = '';
        for (let i = 0; i < length; i++) {
            const charCode = this.readUInt8();
            if (i !== length - 1) {
                out += String.fromCharCode(charCode);
            }
        }
        return decodeUTF8(out);
    }

    readBitGroup() {
        const bytes = [];
        let current;
        do {
            current = this.readUInt8();
            bytes.push(current);
        } while ((current & 0x01) !== 0);

        let bitIndex = 1;
        let byteIndex = 0;

        return {
            bytes,
            getBool() {
                const value = (((bytes[byteIndex] || 0) >> bitIndex) & 0x01) !== 0;
                bitIndex += 1;
                if (bitIndex > 7) {
                    bitIndex = 1;
                    byteIndex += 1;
                }
                return value;
            },
        };
    }
}
