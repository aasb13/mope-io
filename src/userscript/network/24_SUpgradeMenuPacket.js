class UpgradeMenuPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        try {
            // Server packet 0x18 (24): upgrade/respawn menu with animal choices.
            // Reference: assets/deobf.js class _0x14f68b.readUpgradeMenu/handle.
            this.isSpectator = packetUtil.readUInt8() === 1;
            this.gameSession = packetUtil.readUInt8();
            this.timeout = packetUtil.readUInt8();
            this.upgradeLevel = packetUtil.readUInt8();
            this.choicesCount = packetUtil.readUInt8();

            this.animalChoices = [];
            for (let i = 0; i < this.choicesCount; i++) {
                const choice = {
                    season: packetUtil.readUInt8(),
                    animalType: packetUtil.readUInt8(),
                    biomeNum: packetUtil.readUInt8(),
                    species: packetUtil.readUInt8(),
                    subSpecies: packetUtil.readUInt16(),
                    premiumSkinType: packetUtil.readUInt8(),
                    skinThemeID: packetUtil.readUInt8(),
                    isBought: packetUtil.readUInt8() === 1,
                    itemId: packetUtil.readString(),
                    choiceIndex: i,
                };
                enrichAnimalRecord(choice);
                this.animalChoices.push(choice);
            }
        } catch (error) {
            this.setParsingError(error);
        }

        this.finish();
    }
}
