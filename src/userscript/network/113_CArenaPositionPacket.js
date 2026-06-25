class ArenaPositionPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js class _0x257b3d (type 0x71 = 113).
        // Arena position/target packet with coordinates and nick.
        this.x = packetUtil.readUInt16();
        this.y = packetUtil.readUInt16();
        this.nick = packetUtil.readString();

        this.finish();
    }
}
