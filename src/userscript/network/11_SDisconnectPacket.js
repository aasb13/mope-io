class DisconnectPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.reasonCode = packetUtil.readUInt8();
        this.message = packetUtil.readString();
        this.shouldRefresh = packetUtil.readUInt8() > 0;

        this.isError = this.reasonCode > 0;
        this.isHardDisconnect = this.reasonCode === 100;
        this.requiresAction = (this.reasonCode !== 2 && this.isError) || this.shouldRefresh;
        this.finish();
    }
}
