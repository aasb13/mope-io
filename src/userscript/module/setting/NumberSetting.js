class NumberSetting extends Setting {
    constructor(config) {
        super(config);

        const {
            min = null,
            max = null,
        } = config || {};

        this.min = min;
        this.max = max;
        this.validate(this.value);
    }

    validate(value) {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new Error(`Number setting "${this.name}" requires a valid number.`);
        }

        if (this.min != null && value < this.min) {
            throw new Error(`Number setting "${this.name}" must be >= ${this.min}.`);
        }

        if (this.max != null && value > this.max) {
            throw new Error(`Number setting "${this.name}" must be <= ${this.max}.`);
        }
    }
}
