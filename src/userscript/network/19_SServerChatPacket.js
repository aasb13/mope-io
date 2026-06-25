class ServerChatPacket extends Packet {
    constructor(view) {
        super(view, 1);
        this.flags = view.getUint8(1);
        this.entityId = view.getUint32(2, true);
        this.messageLength = view.getUint8(6);
        this.message = '';

        for (let i = 0; i < this.messageLength; i++) {
            this.message += String.fromCharCode(view.getUint8(7 + i));
        }

        this.finish(7 + this.messageLength);
    }
}
