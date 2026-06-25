class LoadUserDataPacket extends Packet {
    constructor(view) {
        super(view, 1);

        // Reference: assets/deobf.js server dispatch case 0x66.
        // No data payload - server just signals client to load user data.
        this.finish(1);

        if (this.bytesRemaining > 0) {
            this.setParsingError(`Unexpected payload: ${this.bytesRemaining} byte(s) remaining`);
        }
    }
}
