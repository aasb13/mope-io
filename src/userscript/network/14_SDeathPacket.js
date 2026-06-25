class DeathPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        try {
            // Reference: assets/deobf.js server dispatch case 0x0e ("YOU DIED MESSAGE").
            this.deathReasonCode = packetUtil.readUInt8();
            this.deathReasonName = DeathPacket.DEATH_REASON_NAMES[this.deathReasonCode] || 'unknown';

            this.spawnXp = packetUtil.readUInt32();
            this.spawnXpFormatted = `${this.spawnXp}`;

            this.coinsLabel = packetUtil.readString();

            this.rank = packetUtil.readUInt16();
            this.killedBy = packetUtil.readString();
            this.playTimeSeconds = packetUtil.readUInt32();
            this.playTimeFormatted = formatDeathPacketDuration(this.playTimeSeconds);
            this.totalKills = packetUtil.readUInt16();
            this.maxXp = packetUtil.readUInt32();
            this.oneVsOneWins = packetUtil.readUInt8();

            this.isPlayerKill = this.deathReasonCode === 0x01 || this.deathReasonCode === 0x02;
            this.isResourceDeath =
                this.deathReasonCode === 0x04 ||
                this.deathReasonCode === 0x1b ||
                this.deathReasonCode === 0x1c ||
                this.deathReasonCode === 0x1d;
        } catch (error) {
            this.setParsingError(error);
        }

        this.finish();
    }
}

function formatDeathPacketDuration(totalSeconds = 0) {
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

DeathPacket.DEATH_REASON_NAMES = {
    0x01: 'eaten',
    0x02: 'tailBite',
    0x04: 'thirst',
    0x0d: 'burning',
    0x1b: 'airSuffocation',
    0x1c: 'lavaSuffocation',
    0x1d: 'lowEnergy',
};
