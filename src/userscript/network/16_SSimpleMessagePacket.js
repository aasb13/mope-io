class SimpleMessagePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x10.
        this.message = packetUtil.readString();
        this.variant = 'success';
        this.durationSeconds = 15;

        this.finish();
    }
}
