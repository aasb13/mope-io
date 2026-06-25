class InterfaceButtonPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js lines 6923-6927.
        // Interface button click packet type 0x3d (61).
        this.interfaceType = packetUtil.readUInt8();
        this.buttonId = packetUtil.readUInt8();

        this.finish();
    }
}
