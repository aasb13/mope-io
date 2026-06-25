class Setting {
    constructor(config) {
        const {
            name,
            description = '',
            value = null,
        } = config || {};

        if (!name) {
            throw new Error('Setting requires a name.');
        }

        this.name = name;
        this.description = description;
        this.value = value;
        this.module = null;
    }

    bindModule(module) {
        this.module = module;
        return this;
    }

    getValue() {
        return this.value;
    }

    setValue(value) {
        this.validate(value);
        this.value = value;
        this.onChange(value);
        return this.value;
    }

    validate() {}

    onChange() {}
}
