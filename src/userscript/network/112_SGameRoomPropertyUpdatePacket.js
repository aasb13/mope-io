class GameRoomPropertyUpdatePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x70 and
        // _0x34d251.prototype.readGameRoomPropertyUpdate/readUpdatedPropertyItem.
        this.propertyCount = packetUtil.readUInt8();
        this.properties = [];

        for (let i = 0; i < this.propertyCount; i++) {
            const propertyId = packetUtil.readUInt8();
            const property = {
                propertyId,
                propertyName: GameRoomPropertyUpdatePacket.PROPERTY_NAMES[propertyId] || 'Unknown',
            };

            switch (propertyId) {
                case 1:
                case 2:
                    property.value = packetUtil.readUInt8() === 1;
                    break;
                case 3:
                    break;
                default:
                    property.unparsed = true;
                    break;
            }

            this.properties.push(property);
        }

        this.finish();
    }
}

GameRoomPropertyUpdatePacket.PROPERTY_NAMES = {
    1: 'ApocalypseStarted',
    2: 'ApocalypseEnded',
    3: 'ApocalypseTimeLeft',
};
