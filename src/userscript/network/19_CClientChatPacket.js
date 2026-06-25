class ClientChatPacket extends Packet {
    constructor(view) {
        super(view, 1);
        this.subType = view.getUint8(1);
        this.length = view.getUint8(2);
        this.message = '';

        for (let i = 0; i < this.length; i++) {
            this.message += String.fromCharCode(view.getUint8(3 + i));
        }

        this.finish(3 + this.length);
    }
}
