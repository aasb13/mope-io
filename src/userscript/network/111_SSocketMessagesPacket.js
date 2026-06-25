class SocketMessagesPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x6f and
        // _0x34d251.prototype.socketMessages.
        this.subType = packetUtil.readUInt8();
        this.subTypeName = SocketMessagesPacket.SUBTYPE_NAMES[this.subType] || 'Unknown';

        switch (this.subType) {
            case 1:
            case 2:
                this.buffId = packetUtil.readUInt8();
                this.buffName = packetUtil.readString();
                this.variant = this.subType === 1 ? 'success' : 'error';
                this.durationSeconds = 6;
                this.message = this.subType === 1
                    ? `Nice, your team has unlocked '${this.buffName}' buff.`
                    : `Oh no, '${this.buffName}' buff has been compromised!`;
                break;
            case 3:
                this.apocalypseType = packetUtil.readString();
                this.triggeredByTeamId = packetUtil.readUInt8();
                this.apocalypseStatus = packetUtil.readString();
                this.timeLeftSeconds = packetUtil.readUInt16() / 100;
                break;
            case 4:
                this.apocalypseType = null;
                this.triggeredByTeamId = 0;
                this.apocalypseStatus = null;
                this.timeLeftSeconds = 0;
                this.variant = 'success';
                this.durationSeconds = 6;
                this.message = 'Apocalypse is over. Now, you can go anywhere freely!';
                break;
            case 5:
                this.isApocalypseInProgress = packetUtil.readUInt8() === 1;
                if (this.isApocalypseInProgress) {
                    this.apocalypseType = packetUtil.readString();
                    this.triggeredByTeamId = packetUtil.readUInt8();
                    this.apocalypseStatus = packetUtil.readString();
                    this.timeLeftSeconds = packetUtil.readUInt16() / 100;
                }
                break;
            case 6:
                this.team1 = packetUtil.readUInt16();
                this.team2 = packetUtil.readUInt16();
                this.team3 = packetUtil.readUInt16();
                this.teamDistribution = {
                    1: this.team1,
                    2: this.team2,
                    3: this.team3,
                };
                break;
            case 7:
                this.stoneCount = packetUtil.readUInt8();
                this.capturedStones = [];
                for (let i = 0; i < this.stoneCount; i++) {
                    this.capturedStones.push({
                        stoneBuffId: packetUtil.readUInt8(),
                        hp: packetUtil.readUInt8() / 100,
                    });
                }
                break;
            default:
                this.unparsed = true;
                break;
        }

        this.finish();
    }
}

SocketMessagesPacket.SUBTYPE_NAMES = {
    1: 'TeamBuffUnlocked',
    2: 'TeamBuffCompromised',
    3: 'ApocalypseStarted',
    4: 'ApocalypseEnded',
    5: 'ApocalypseState',
    6: 'TeamPieChart',
    7: 'CapturedStones',
};
