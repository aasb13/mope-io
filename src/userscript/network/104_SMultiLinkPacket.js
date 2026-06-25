class MultiLinkPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x68 ("muilink").
        this.url = packetUtil.readString();
        this.finish();
    }
}
