class MiniMapMarkerPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x6d.
        this.entityId = packetUtil.readUInt32();
        this.hasMarker = this.entityId > 0;

        if (this.hasMarker) {
            this.x = packetUtil.readUInt32();
            this.y = packetUtil.readUInt32();
            this.radius = 3;
        }

        this.finish();
    }
}
