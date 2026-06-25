class AnnouncementPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x43.
        this.message = packetUtil.readString();

        this.finish();
    }
}
