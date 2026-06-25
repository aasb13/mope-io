class PacketEvent extends MopEvent {
    constructor({ name = 'packet', direction, ws, buffer, nativeEvent = null }) {
        super();
        this.name = name;
        this.direction = direction;
        this.ws = ws || null;
        this.buffer = PacketUtil.normalizePacketBuffer(buffer);
        this.nativeEvent = nativeEvent;
        this.errors = [];
        this._parsed = null;
        this._parsedBuffer = null;
    }

    get packet() {
        return this.parse().parsedPacket;
    }

    get packetClass() {
        const packet = this.packet;
        return packet ? packet.packetClass : null;
    }

    get data() {
        return this.buffer;
    }

    set data(buffer) {
        this.setBuffer(buffer);
    }

    setBuffer(buffer) {
        this.buffer = PacketUtil.normalizePacketBuffer(buffer);
        this._parsed = null;
        this._parsedBuffer = null;
        return this.buffer;
    }

    getView() {
        return new DataView(this.buffer);
    }

    getHeader() {
        return this.buffer.byteLength > 0 ? this.getView().getUint8(0) : null;
    }

    parse() {
        if (this._parsed && this._parsedBuffer === this.buffer) {
            return this._parsed;
        }

        this._parsed = parsePacket(this.direction, this.buffer);
        this._parsedBuffer = this.buffer;
        return this._parsed;
    }
}
