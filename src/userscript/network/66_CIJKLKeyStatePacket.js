class IJKLKeyStatePacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        packetUtil.readUInt8();
        this.isPressed = packetUtil.readUInt8() === 1;
        this.inputIndex = packetUtil.readUInt8();
        this.inputKey = IJKLKeyStatePacket.KEY_BY_INDEX[this.inputIndex] || null;
        this.arenaOptionName = IJKLKeyStatePacket.OPTION_BY_INDEX[this.inputIndex] || null;
        this.finish();
    }
}

IJKLKeyStatePacket.KEY_BY_INDEX = {
    1: 'I',
    2: 'J',
    3: 'K',
    4: 'L',
};

IJKLKeyStatePacket.OPTION_BY_INDEX = {
    1: 'Water',
    2: 'Health',
    3: 'Speed',
    4: 'Wall',
};
