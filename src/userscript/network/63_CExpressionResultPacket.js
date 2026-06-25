class ExpressionResultPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js lines 34837-34840.
        // Expression challenge response packet type 0x3f (63).
        // Format: "eval|result" string
        this.result = packetUtil.readString();

        this.finish();
    }
}
