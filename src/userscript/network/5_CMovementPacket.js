class MovementPacket extends Packet {
    constructor(view) {
        super(view, 1);
        this.directionX = view.getInt16(1, false);
        this.directionY = view.getInt16(3, false);
        this.finish(5);
    }
}
