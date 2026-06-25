class AdblockCheckPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.checkId = packetUtil.readUInt16();
        this.challenge = packetUtil.readString();
        this.finish();
    }
}
