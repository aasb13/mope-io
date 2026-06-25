class AlternateKeyInputPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js lines 40744-40748 (case 0x7).
        // Alternate key input packet type 0x1d (29), single bool byte.
        this.active = packetUtil.readUInt8() === 1;

        this.finish();
    }
}
