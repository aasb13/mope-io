class SnowfallStatePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x64.
        this.weatherType = packetUtil.readUInt8();
        this.weatherName = SnowfallStatePacket.WEATHER_NAMES[this.weatherType] || 'Unknown';
        this.isActive = this.weatherType !== 0;

        this.finish();
    }
}

SnowfallStatePacket.WEATHER_NAMES = {
    0: 'None',
    1: 'LightSnow',
    2: 'MediumSnow',
    3: 'HeavySnow',
};
