class AutoAttackModule extends Module {
    constructor() {
        super({
            key: 'autoAttack',
            name: 'Auto Attack',
            category: Category.COMBAT,
            description: 'Combat module placeholder.',
            settings: [
                new BooleanSetting({
                    name: 'Boolean setting',
                    description: 'Description.',
                    value: false,
                }),
                new NumberSetting({
                    name: 'Number setting',
                    description: 'Description.',
                    value: 150,
                    min: 0,
                    max: 1000,
                }),
            ],
        });
    }

    onEnable() {}

    onDisable() {}
}
