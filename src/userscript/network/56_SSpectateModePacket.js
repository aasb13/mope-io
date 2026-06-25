class SpectateModePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x38.
        this.isSpectating = packetUtil.readUInt8() === 1;

        this.finish();
    }
}
