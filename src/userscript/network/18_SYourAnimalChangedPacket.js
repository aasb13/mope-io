class YourAnimalChangedPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;

        try {
            // Reference: assets/deobf.js server dispatch case 0x12 ("MsgYourAnimalChanged").
            this.animalType = packetUtil.readUInt8();
            this.animalName = AnimalType[this.animalType] || null;
            this.animalSpecies = packetUtil.readUInt8();
            this.animalSubSpecies = packetUtil.readUInt16();

            this.changeState = packetUtil.readUInt8();
            this.changeStateName = YourAnimalChangedPacket.CHANGE_STATE_NAMES[this.changeState] || null;
            this.isDowngrade = this.changeState === 0;
            this.isSilentChange = this.changeState === 2;

            this.sessionState = packetUtil.readUInt8();
            this.playerId = packetUtil.readUInt32();
            this.score = packetUtil.readUInt32();
            this.primaryAbilityType = packetUtil.readUInt16();
            this.secondaryAbilityType = packetUtil.readUInt16();
            this.primaryAbility = getAbilityInfo(this.primaryAbilityType, 'W', this);
            this.primaryAbilityName = this.primaryAbility ? this.primaryAbility.name : null;
            this.primaryAbilityImage = this.primaryAbility ? this.primaryAbility.imagePath : null;
            this.secondaryAbility = getAbilityInfo(this.secondaryAbilityType, 'S', this);
            this.secondaryAbilityName = this.secondaryAbility ? this.secondaryAbility.name : null;
            this.secondaryAbilityImage = this.secondaryAbility ? this.secondaryAbility.imagePath : null;

            this.animalTypeLists = [];
            for (let i = 0; i < 4; i++) {
                const count = packetUtil.readUInt8();
                const animalTypes = [];

                for (let j = 0; j < count; j++) {
                    const animalType = packetUtil.readUInt8();
                    animalTypes.push({
                        animalType,
                        animalName: AnimalType[animalType] || null,
                    });
                }

                this.animalTypeLists.push({
                    listIndex: i,
                    listName: YourAnimalChangedPacket.ANIMAL_TYPE_LIST_NAMES[i] || null,
                    count,
                    animalTypes,
                });
            }

            [this.primaryAnimalTypeList, this.secondaryAnimalTypeList, this.tertiaryAnimalTypeList, this.quaternaryAnimalTypeList] =
                this.animalTypeLists;
            enrichAnimalRecord(this);
        } catch (error) {
            this.setParsingError(error);
        }

        this.finish();
    }
}

YourAnimalChangedPacket.CHANGE_STATE_NAMES = {
    0: 'downgrade',
    1: 'upgrade',
    2: 'silent',
};

YourAnimalChangedPacket.ANIMAL_TYPE_LIST_NAMES = Object.freeze([
    'dangerousAnimals',
    'edibleAnimals',
    'tailBiters',
    'edibleObjects',
]);
