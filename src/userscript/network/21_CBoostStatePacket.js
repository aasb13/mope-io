class BoostStatePacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        packetUtil.readUInt8();
        this.boosting = packetUtil.readUInt8() === 1;
        this.finish();
    }
}
