class PlayerInfoPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x45 (ID 69).
        // Server sends a JSON array of player info objects with pid and nick fields.
        const json = packetUtil.readString();
        this.players = [];
        this.parseError = null;

        try {
            this.players = JSON.parse(json);
        } catch (error) {
            this.parseError = error && error.message ? error.message : String(error);
        }

        this.finish();
    }
}
