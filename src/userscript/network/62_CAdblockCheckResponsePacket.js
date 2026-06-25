class AdblockCheckResponsePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.response = packetUtil.readString();
        this.finish();
    }
}
