class ReadyToPlayPacket extends Packet {
    constructor(view) {
        super(view, 1);

        // Reference: assets/deobf.js server dispatch case 0x41 ("Msg_readyToPlay").
        // The client does not read a payload for this packet.
        this.finish(1);

        if (this.bytesRemaining > 0) {
            this.setParsingError(`Unexpected payload: ${this.bytesRemaining} byte(s) remaining`);
        }
    }
}
