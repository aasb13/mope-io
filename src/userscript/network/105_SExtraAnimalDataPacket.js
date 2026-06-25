class ExtraAnimalDataPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x69 (ID 105).
        this.entryCount = packetUtil.readUInt16();
        this.entries = [];

        for (let i = 0; i < this.entryCount; i++) {
            const json = packetUtil.readString();
            let value = null;
            let parseError = null;

            try {
                value = JSON.parse(json);
            } catch (error) {
                parseError = error && error.message ? error.message : String(error);
            }

            this.entries.push({
                index: i,
                json,
                value,
                parseError,
            });
        }

        this.finish();
    }
}
