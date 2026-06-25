class ServerMetricsPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.playersOnServer = packetUtil.readUInt16();
        this.tps = packetUtil.readUInt16() / 10;
        this.finish();
    }
}
