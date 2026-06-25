class CustomInterfacePacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        // Reference: assets/deobf.js server dispatch case 0x3b and _0x10847b.loadData.
        this.interfaceType = packetUtil.readUInt8();
        this.interfaceName = CustomInterfacePacket.INTERFACE_NAMES[this.interfaceType] || 'Unknown';
        this.maxDurationSeconds = packetUtil.readUInt8();

        if (this.interfaceType === 1) {
            this.rows = 13;
            this.data = {
                0x2e: packetUtil.readUInt8(),
                0x47: packetUtil.readUInt8(),
                0x49: packetUtil.readUInt8(),
                0x46: packetUtil.readUInt8(),
                0x48: packetUtil.readUInt8(),
                0x5f: packetUtil.readUInt8(),
                0x44: packetUtil.readUInt8(),
                0x0e: packetUtil.readUInt8(),
                0x35: packetUtil.readUInt8(),
                0x18: packetUtil.readUInt8(),
                0x3d: packetUtil.readUInt8(),
                0x20: packetUtil.readUInt8(),
                0x60: packetUtil.readUInt8(),
            };
            this.animalOptions = [0x3d, 0x20, 0x60, 0x2e, 0x47, 0x49, 0x46, 0x48, 0x5f, 0x44, 0x0e, 0x35, 0x18];
        } else {
            this.rows = 4;
            this.selected = packetUtil.readUInt8();
            this.data = {
                0x00: packetUtil.readUInt8(),
                0x01: packetUtil.readUInt8(),
                0x02: packetUtil.readUInt8(),
                0x03: 0,
            };
        }

        this.finish();
    }
}

CustomInterfacePacket.INTERFACE_NAMES = {
    1: 'ApexKills',
    2: 'ChooseMainAbility',
    3: 'ChoosePassiveAbility',
};
