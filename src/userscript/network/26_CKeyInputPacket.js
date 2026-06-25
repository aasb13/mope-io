class KeyInputPacket extends Packet {
    constructor(view) {
        super(view, 0);

        // Reference: assets/deobf.js lines 40706-40709 (case 0x3).
        // Key input packet type 0x1a (26), no payload.
        this.finish(0);
    }
}
