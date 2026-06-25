class ResizePacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        packetUtil.readUInt8();
        this.canvasWidth = packetUtil.readUInt16();
        this.canvasHeight = packetUtil.readUInt16();
        this.scaleValue = packetUtil.readUInt16();
        this.finish();
    }
}
