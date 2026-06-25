class ExtraKeyInputPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js lines 40734-40738 (case 0x6).
        // Extra key input packet type 0x1e (30), single bool byte.
        this.active = packetUtil.readUInt8() === 1;

        this.finish();
    }
}
