class StringSetting extends Setting {
    constructor(config) {
        super(config);
        this.validate(this.value);
    }

    validate(value) {
        if (typeof value !== 'string') {
            throw new Error(`String setting "${this.name}" requires a string value.`);
        }
    }
}
