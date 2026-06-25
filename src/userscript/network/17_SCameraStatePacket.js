class CameraStatePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x11.
        // class _0x1d5169 handles this packet type.
        this.gameWidth = packetUtil.readUInt16();
        this.gameHeight = packetUtil.readUInt16();
        this.camX = packetUtil.readUInt16();
        this.camY = packetUtil.readUInt16();
        this.camZoom = packetUtil.readUInt16();

        this.finish();
    }
}
