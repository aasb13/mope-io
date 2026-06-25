class StatusEffectPacket extends Packet {
    constructor(view) {
        // Reference: assets/deobf.js server dispatch case 0x17 (decimal 23).
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.effectId = packetUtil.readUInt8();
        this.effectName = StatusEffectPacket.EFFECT_NAMES[this.effectId] || null;
        this.message = StatusEffectPacket.DEFAULT_MESSAGES[this.effectId] || null;

        if (this.effectId === 0xff) {
            this.message = packetUtil.readString();
            this.durationRaw = packetUtil.readUInt16();
            this.durationSeconds = this.durationRaw / 100;
        }

        this.isCustomMessage = this.effectId === 0xff;
        this.isKnownEffect = Object.prototype.hasOwnProperty.call(StatusEffectPacket.EFFECT_NAMES, this.effectId);
        this.finish();
    }
}

StatusEffectPacket.EFFECT_NAMES = {
    0x02: 'tailBitten',
    0x03: 'stingrayShock',
    0x05: 'krakenPull',
    0x06: 'pufferfishHit',
    0x07: 'octopusDisguise',
    0x08: 'inked',
    0x09: 'frozen',
    0x0a: 'wolfHowl',
    0x0b: 'loudSound',
    0x0c: 'jellyfishSting',
    0x0d: 'onFire',
    0x0e: 'donkeyKick',
    0x10: 'crocDrag',
    0x11: 'foxDigOut',
    0x12: 'waveSweep',
    0x21: 'silent',
    0xff: 'custom',
};

StatusEffectPacket.DEFAULT_MESSAGES = {
    0x02: 'Ouch! Your tail got bitten!',
    0x03: "ZAP! You've been shocked by a STINGRAY!",
    0x05: "Oh no! Escape the kraken's pull!",
    0x06: 'Ouch! Pufferfish are pointy!',
    0x07: "That's an octopus in disguise!",
    0x08: "You've been inked!",
    0x09: "Brrr! You've been frozen!",
    0x0a: "Ahh! The wolf's howl scared you!",
    0x0b: 'Ouch! A VERY LOUD sound hit you!',
    0x0c: "You've been stung by a jellyfish!",
    0x0d: "Ah! You're on fire!",
    0x0e: 'BAM! You got kicked by a donkey!',
    0x10: "Ouch! You're getting dragged by a croc!",
    0x11: 'A fox DUG you out of the hole!',
    0x12: 'A wave has swept you away!',
    0x21: null,
};
