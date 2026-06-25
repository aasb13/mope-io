class DisconnectOnExceedingRateLimitPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x71.
        this.message = packetUtil.readString();
        this.variant = 'error';
        this.durationSeconds = 10;

        this.finish();
    }
}
