class PumpkinsOnMiniMapPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.pumpkinCount = packetUtil.readUInt16();
        this.pumpkins = [];

        for (let i = 0; i < this.pumpkinCount; i++) {
            this.pumpkins.push({
                x: packetUtil.readUInt16() / 4,
                y: packetUtil.readUInt16() / 4,
                type: 0,
                rad: 2,
            });
        }

        this.finish();
    }
}
