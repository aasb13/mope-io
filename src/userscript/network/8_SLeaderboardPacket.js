class LeaderboardPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.selfEntry = {
            rank: packetUtil.readUInt16(),
            name: packetUtil.readString(),
            score: packetUtil.readUInt32(),
        };

        this.entryCount = packetUtil.readUInt8();
        this.entries = [];

        for (let i = 0; i < this.entryCount; i++) {
            this.entries.push({
                rank: packetUtil.readUInt16(),
                name: packetUtil.readString(),
                score: packetUtil.readUInt32(),
            });
        }

        this.finish();
    }
}
