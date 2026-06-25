class ArenaTargetPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js _0x2a0048 / opcode 0x44.
        packetUtil.readUInt8();
        this.targetEntityId = packetUtil.readUInt32();

        this.finish();
    }
}
