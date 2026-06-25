class LoginCredentialsPacket extends Packet {
    constructor(view) {
        super(view, 0);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js lines 22437-22443.
        // Login credentials packet type 0x47 (71).
        this.hasCredentials = packetUtil.readUInt8() === 1;
        this.username = null;
        this.password = null;

        if (this.hasCredentials) {
            this.username = packetUtil.readString();
            this.password = packetUtil.readString();
        }

        this.finish();
    }
}
