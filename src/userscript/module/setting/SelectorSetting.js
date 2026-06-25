class SelectorSetting extends Setting {
    constructor(config) {
        super(config);

        const {
            options = [],
        } = config || {};

        this.options = options.slice();
        this.validate(this.value);
    }

    validate(value) {
        if (typeof value !== 'string') {
            throw new Error(`Selector setting "${this.name}" requires a string value.`);
        }

        if (!this.options.includes(value)) {
            throw new Error(`Selector setting "${this.name}" must be one of: ${this.options.join(', ')}.`);
        }
    }
}
