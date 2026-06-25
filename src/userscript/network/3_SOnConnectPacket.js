class OnConnectPacket extends Packet {
    constructor(view) {
        super(view, 1);

        // In `assets/deobf.js`, server message type 0x03 is handled with no reads from the buffer.
        // Treat any extra bytes as unexpected.
        this.finish(1);

        if (this.bytesRemaining > 0) {
            this.setParsingError(`Unexpected payload: ${this.bytesRemaining} byte(s) remaining`);
        }
    }
}
