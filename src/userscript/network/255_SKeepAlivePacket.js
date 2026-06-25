class KeepAliveResponsePacket extends Packet {
    constructor(view) {
        super(view, 1);

        // Reference: assets/deobf.js server dispatch case 0xff.
        // Server responds to client's keepalive ping with empty packet.
        this.finish(1);

        if (this.bytesRemaining > 0) {
            this.setParsingError(`Unexpected payload: ${this.bytesRemaining} byte(s) remaining`);
        }
    }
}
