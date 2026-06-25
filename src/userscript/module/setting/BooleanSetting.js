class BooleanSetting extends Setting {
    constructor(config) {
        super(config);
        this.validate(this.value);
    }

    validate(value) {
        if (typeof value !== 'boolean') {
            throw new Error(`Boolean setting "${this.name}" requires a boolean value.`);
        }
    }
}
