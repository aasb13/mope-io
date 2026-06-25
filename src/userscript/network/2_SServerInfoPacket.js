class ServerInfoPacket extends Packet {
    constructor(view) {
        super(view, 1);
        let offset = 1;

        const readString = () => {
            if (offset + 2 > view.byteLength) {
                return '';
            }

            const length = view.getUint16(offset, false);
            offset += 2;

            if (offset + length > view.byteLength) {
                return '';
            }

            let value = '';
            for (let i = 0; i < length; i++) {
                value += String.fromCharCode(view.getUint8(offset++));
            }
            return decodeUTF8(value);
        };

        this.sessionId = readString();
        this.gameMode = view.getUint8(offset++);
        this.season = view.getUint8(offset++);
        this.serverId = readString();
        this.isAliveInGame = view.getUint8(offset++) === 1;
        this.staticObjectsCount = view.getUint16(offset, false);
        offset += 2;
        this.staticObjects = [];

        for (let i = 0; i < this.staticObjectsCount; i++) {
            const objectInfo = {
                type: view.getUint8(offset++),
                id: view.getUint32(offset, false),
            };
            offset += 4;

            objectInfo.rad = view.getUint32(offset, false) / 4;
            offset += 4;
            objectInfo.x = view.getUint16(offset, false) / 4;
            offset += 2;
            objectInfo.y = view.getUint16(offset, false) / 4;
            offset += 2;
            objectInfo.curBiome = view.getUint8(offset++);
            objectInfo.curBiomeName = getBiomeName(objectInfo.curBiome);

            if (objectInfo.type === 0x0e) {
                objectInfo.foodType = view.getUint16(offset, false);
                offset += 2;
                objectInfo.canopy = view.getUint8(offset++) === 1;
                objectInfo.eventType = view.getUint8(offset++);
            }

            this.staticObjects.push(objectInfo);
        }

        this.finish(offset);
    }
}
