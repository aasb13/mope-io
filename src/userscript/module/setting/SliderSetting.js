class SliderSetting extends Setting {
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
        if (!Array.isArray(value) || value.length !== 2) {
            throw new Error(`Slider setting "${this.name}" requires a [from, to] array.`);
        }

        const [from, to] = value;
        if (typeof from !== 'number' || Number.isNaN(from) || typeof to !== 'number' || Number.isNaN(to)) {
            throw new Error(`Slider setting "${this.name}" requires numeric bounds.`);
        }

        if (from > to) {
            throw new Error(`Slider setting "${this.name}" requires from <= to.`);
        }

        if (this.min != null && from < this.min) {
            throw new Error(`Slider setting "${this.name}" requires from >= ${this.min}.`);
        }

        if (this.max != null && to > this.max) {
            throw new Error(`Slider setting "${this.name}" requires to <= ${this.max}.`);
        }
    }
}
