class TurnstileChallengePacket extends Packet {
    constructor(view) {
        super(view, 1);
        this.finish(1);
    }
}
