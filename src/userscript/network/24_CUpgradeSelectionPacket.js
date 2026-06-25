class UpgradeSelectionPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        packetUtil.readUInt8();
        this.choiceIndex = packetUtil.readUInt8();
        this.finish();
    }
}
