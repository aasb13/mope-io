class PlayerAliveInGamePacket extends Packet {
    constructor(view) {
        super(view, 1);

        // `assets/deobf.js` handles server message 0x06 without consuming payload bytes.
        this.finish(1);

        if (this.bytesRemaining > 0) {
            this.setParsingError(`Unexpected payload: ${this.bytesRemaining} byte(s) remaining`);
        }
    }
}
