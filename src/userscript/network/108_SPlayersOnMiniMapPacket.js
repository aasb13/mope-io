class PlayersOnMiniMapPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x6c and
        // _0x34d251.prototype.msgDisplayPlayersOnMiniMap.
        this.playerCount = packetUtil.readUInt16();
        this.players = [];

        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                teamId: packetUtil.readUInt16(),
                x: packetUtil.readUInt32() / 100,
                y: packetUtil.readUInt32() / 100,
                radius: 3,
            });
        }

        this.finish();
    }
}
