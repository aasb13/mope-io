class SecondaryKeyInputPacket extends Packet {
    constructor(view) {
        super(view, 0);

        // Reference: assets/deobf.js lines 40715-40718 (case 0x4).
        // Secondary key input packet type 0x1b (27), no payload.
        this.finish(0);
    }
}
