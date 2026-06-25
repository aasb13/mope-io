class HandshakePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        this.magic = packetUtil.readUInt32();
        this.gameVersion = packetUtil.readUInt32();
        this.viewportWidth = packetUtil.readUInt16();
        this.viewportHeight = packetUtil.readUInt16();
        this.scale = packetUtil.readUInt16();
        this.sessionId = packetUtil.readString();
        this.isReconnect = this.sessionId.length > 0;
        this.finish();
    }
}
