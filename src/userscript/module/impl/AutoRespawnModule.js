class AutoRespawnModule extends Module {
    constructor() {
        super({
            key: 'autoRespawn',
            name: 'Auto Respawn',
            category: Category.PLAYER,
            description: 'Player module placeholder.',
            settings: [
                new BooleanSetting({
                    name: 'Boolean setting',
                    description: 'Description.',
                    value: true,
                }),
                new StringSetting({
                    name: 'String setting',
                    description: 'Description.',
                    value: '',
                }),
            ],
        });
    }

    onEnable() {}

    onDisable() {}
}
