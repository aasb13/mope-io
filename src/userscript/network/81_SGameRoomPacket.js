function formatGameRoomDuration(totalSeconds = 0) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds - hours * 3600) / 60);
    const seconds = totalSeconds - hours * 3600 - minutes * 60;

    let output = '';

    if (hours >= 1) {
        output += `${hours}h `;
    }

    if (hours >= 1 || minutes >= 1) {
        output += `${minutes}m `;
    }

    output += `${seconds}s`;
    return output;
}

class GameRoomPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.subType = packetUtil.readUInt8();
        this.subTypeName = GameRoomPacket.SUBTYPE_NAMES[this.subType] || 'UnknownGameRoomMessage';

        switch (this.subType) {
            case 0x25:
                // Battle Royale / game-room countdown message.
                // Reference: assets/deobf.js _0x34ce69.prototype.handleMessage case 0x25.
                this.secondsRemaining = packetUtil.readUInt16();
                this.formattedDuration = formatGameRoomDuration(this.secondsRemaining);
                this.isImminent = this.secondsRemaining < 3;
                this.isStartingNow = this.secondsRemaining === 0;
                break;
            case 0x29:
                // State update used by the client alongside other game-room messages.
                this.state = packetUtil.readUInt8();
                this.playersJoined = packetUtil.readUInt16();
                break;
            default:
                break;
        }

        this.finish();
    }
}

GameRoomPacket.SUBTYPE_NAMES = {
    0x25: 'BattleBeginsCountdown',
    0x29: 'BattleRoyaleStateUpdate',
};
