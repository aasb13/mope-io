class ReceivePacketEvent extends PacketEvent {
    constructor(payload) {
        super({
            ...payload,
            name: 'receivePacket',
            direction: 'RECV',
        });
    }
}
