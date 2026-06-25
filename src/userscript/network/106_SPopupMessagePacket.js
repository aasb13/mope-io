class PopupMessagePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x6a.
        this.message = packetUtil.readString();
        this.variant = packetUtil.readString();
        this.durationSeconds = packetUtil.readUInt8();

        this.finish();
    }
}
