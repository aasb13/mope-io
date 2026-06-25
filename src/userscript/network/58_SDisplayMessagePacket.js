class DisplayMessagePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x3a.
        this.messageType = packetUtil.readUInt8();
        this.message = packetUtil.readString();

        this.finish();
    }
}
