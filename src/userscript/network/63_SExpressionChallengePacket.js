class ExpressionChallengePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x3f.
        this.challengeId = packetUtil.readUInt32();
        this.expression = packetUtil.readString();

        this.finish();
    }
}
