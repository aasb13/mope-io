class SendPacketEvent extends PacketEvent {
    constructor(payload) {
        super({
            ...payload,
            name: 'sendPacket',
            direction: 'SENT',
        });
    }
}
