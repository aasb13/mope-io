class Packet {
    constructor(view, offset = 1) {
        this.view = view;
        this.header = view.getUint8(0);
        this.packetId = this.header;
        this.packetUtil = new PacketUtil(view, offset);
        this.bytesParsed = offset;
        this.bytesRemaining = Math.max(0, view.byteLength - offset);
        this.direction = null;
        this.packetName = this.constructor.name || 'Packet';
        this.packetClass = this.constructor;
        this.isKnownPacket = this.constructor !== Packet;
    }

    finish(bytesParsed = this.packetUtil ? this.packetUtil.offset : this.bytesParsed) {
        this.bytesParsed = bytesParsed;
        this.bytesRemaining = Math.max(0, this.view.byteLength - this.bytesParsed);
        return this;
    }

    setParsingError(error) {
        this.parsingError = error && error.message ? error.message : String(error);
        return this;
    }


    setDirection(direction) {
        this.direction = direction || null;
        return this;
    }

    setPacketClass(PacketClass) {
        this.packetClass = typeof PacketClass === 'function' ? PacketClass : Packet;
        this.packetName = this.packetClass.name || 'Packet';
        this.isKnownPacket = this.packetClass !== Packet;
        return this;
    }
}
