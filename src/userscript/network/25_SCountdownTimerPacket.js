class CountdownTimerPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js top-level server dispatch case 0x19.
        this.timerType = packetUtil.readUInt8();
        this.timerTypeName = CountdownTimerPacket.TIMER_TYPE_NAMES[this.timerType] || 'unknown';

        this.tenthsRemaining = packetUtil.readUInt32();
        this.secondsRemaining = this.tenthsRemaining / 10;
        this.millisecondsRemaining = this.secondsRemaining * 1000;

        this.isPrimary = this.timerType === 0;
        this.isSecondary = this.timerType === 1;
        this.isTertiary = this.timerType === 2;

        this.finish();
    }
}

CountdownTimerPacket.TIMER_TYPE_NAMES = {
    0: 'primary',
    1: 'secondary',
    2: 'tertiary',
};
