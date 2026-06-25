class CleanDisconnectPacket extends Packet {
    constructor(view) {
        super(view, 0);

        // Reference: assets/deobf.js line 3709.
        // Clean disconnect - just sends packet type, no payload.
        this.finish(0);
    }
}
