class MiniMapPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x6b and _0x35b69c.create/_0x2b4aa5.loadMiniMap.
        this.season = packetUtil.readUInt8();
        this.seasonName = MiniMapPacket.SEASON_NAMES[this.season] || 'Unknown';
        this.supportedSeason = this.season === 1 || this.season === 2;

        if (this.supportedSeason) {
            this.scale = packetUtil.readUInt16();
            this.objectScale = packetUtil.readUInt16();
            this.mapWidth = packetUtil.readUInt16();
            this.mapHeight = packetUtil.readUInt16();
            this.gameWidth = packetUtil.readUInt16();
            this.gameHeight = packetUtil.readUInt16();
            this.objectGroupCount = packetUtil.readUInt16();
            this.objects = [];

            for (let groupIndex = 0; groupIndex < this.objectGroupCount; groupIndex++) {
                const groupSize = packetUtil.readUInt16();
                for (let i = 0; i < groupSize; i++) {
                    const objectType = packetUtil.readUInt16();
                    const biome = packetUtil.readUInt16();
                    const isRect = packetUtil.readUInt8() === 1;
                    const objectInfo = {
                        groupIndex,
                        objectType,
                        biome,
                        isRect,
                    };

                    if (objectType === 0x4e) {
                        objectInfo.teamId = packetUtil.readUInt8();
                    }

                    if (isRect) {
                        objectInfo.x = packetUtil.readUInt16();
                        objectInfo.y = packetUtil.readUInt16();
                        objectInfo.width = packetUtil.readUInt16();
                        objectInfo.height = packetUtil.readUInt16();
                    } else {
                        objectInfo.radius = packetUtil.readUInt16();
                        objectInfo.x = packetUtil.readUInt16();
                        objectInfo.y = packetUtil.readUInt16();
                    }

                    this.objects.push(objectInfo);
                }
            }
        }

        this.finish();
    }
}

MiniMapPacket.SEASON_NAMES = {
    1: 'Season1',
    2: 'Season2',
};
