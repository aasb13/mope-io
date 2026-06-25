class PacketLoggerModule extends Module {
    constructor() {
        super({
            key: 'packetLogger',
            name: 'Packet Logger',
            category: Category.OTHER,
            description: 'Other module placeholder.',
            settings: [
                new BooleanSetting({
                    name: 'Log Sent Packets',
                    description: 'Includes client-sent packets in the logger.',
                    value: true,
                }),
                new BooleanSetting({
                    name: 'Log Received Packets',
                    description: 'Includes server-sent packets in the logger.',
                    value: true,
                }),
            ],
        });

        this.lastSentPacketHeader = null;
        this.lastReceivedPacketHeader = null;
    }

    onEnable() {}

    onDisable() {}

    onSendPacket(event) {
        const setting = this.getSetting('Log Sent Packets');
        if (!setting || !setting.getValue()) {
            return;
        }

        this.lastSentPacketHeader = event.getHeader();
    }

    onReceivePacket(event) {
        const setting = this.getSetting('Log Received Packets');
        if (!setting || !setting.getValue()) {
            return;
        }

        this.lastReceivedPacketHeader = event.getHeader();
    }
}

EventTarget(
    SendPacketEvent,
    Priority.NORMAL
)(PacketLoggerModule.prototype, 'onSendPacket', Object.getOwnPropertyDescriptor(PacketLoggerModule.prototype, 'onSendPacket'));

EventTarget(
    ReceivePacketEvent,
    Priority.NORMAL
)(PacketLoggerModule.prototype, 'onReceivePacket', Object.getOwnPropertyDescriptor(PacketLoggerModule.prototype, 'onReceivePacket'));
