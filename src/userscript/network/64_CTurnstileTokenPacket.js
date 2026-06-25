class TurnstileTokenPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.token = packetUtil.readString();
        this.finish();
    }
}
