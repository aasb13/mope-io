class ControlInputPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js lines 40923-40928.
        // Control input packet type 0x3c (60).
        // Direction: 0 = negative, 1 = positive
        this.direction = packetUtil.readUInt8();
        this.value = packetUtil.readInt16();

        this.finish();
    }
}
