class ArenaInviteRequestPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js _0x46c9f1 / opcode 0x34.
        packetUtil.readUInt8();
        this.mode = packetUtil.readUInt8();
        this.modeName = ArenaInviteRequestPacket.MODE_NAMES[this.mode] || 'Unknown';

        this.finish();
    }
}

ArenaInviteRequestPacket.MODE_NAMES = {
    0: 'Invite',
};
