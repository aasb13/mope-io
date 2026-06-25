class WAbilityStatePacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        packetUtil.readUInt8();
        this.isActive = packetUtil.readUInt8() === 1;
        this.abilityInput = 'W';
        this.finish();
    }
}
