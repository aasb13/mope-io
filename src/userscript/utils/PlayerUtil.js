class Player {
    constructor(player = null) {
        this.player = player && typeof player === 'object' ? player : null;
        this.playerResolver = typeof player === 'function' ? player : null;
        Object.defineProperty(this, 'entityId', {
            configurable: true,
            enumerable: true,
            get: () => {
                const playerObject = this.getPlayer();
                return playerObject && typeof playerObject === 'object' ? playerObject.entityId : null;
            },
            set: (value) => {
                const playerObject = this.getPlayer();
                if (playerObject && typeof playerObject === 'object') {
                    playerObject.entityId = value;
                }
            },
        });
    }

    setPlayer(player) {
        this.player = player && typeof player === 'object' ? player : null;
        this.playerResolver = typeof player === 'function' ? player : null;
        return this;
    }

    getPlayer() {
        if (typeof this.playerResolver === 'function') {
            const resolvedPlayer = this.playerResolver();
            return resolvedPlayer && typeof resolvedPlayer === 'object' ? resolvedPlayer : null;
        }

        if (this.player && typeof this.player === 'object') {
            return this.player;
        }

        if (typeof getCurrentPlayerEntity === 'function') {
            const currentPlayer = getCurrentPlayerEntity();
            return currentPlayer && typeof currentPlayer === 'object' ? currentPlayer : null;
        }

        return null;
    }

    getXp() {
        const playerObject = this.getPlayer();
        return playerObject && Number.isFinite(playerObject.xp) ? playerObject.xp : null;
    }

    getPosX() {
        const playerObject = this.getPlayer();
        return playerObject && Number.isFinite(playerObject.x) ? playerObject.x : null;
    }

    getPosY() {
        const playerObject = this.getPlayer();
        return playerObject && Number.isFinite(playerObject.y) ? playerObject.y : null;
    }

    getAnimalType() {
        const playerObject = this.getPlayer();
        return playerObject && Number.isFinite(playerObject.animalType) ? playerObject.animalType : null;
    }

    getName() {
        const playerObject = this.getPlayer();
        return playerObject && typeof playerObject.playerName === 'string'
            ? playerObject.playerName
            : (playerObject && typeof playerObject.name === 'string' ? playerObject.name : null);
    }

    getHealth() {
        const playerObject = this.getPlayer();
        return playerObject && Number.isFinite(playerObject.health) ? playerObject.health : null;
    }

    /**
     * Gets the entity's facing angle in radians using the same conversion as the game client.
     * @param {Object} entity - Entity object with packet or live-world angle data
     * @returns {number} Angle in radians
     */
    getEntityFacingAngle(entity) {
        if (!entity) {
            return 0;
        }

        const calculatedAngle = getEntityAngleRadians(entity);
        return Number.isFinite(calculatedAngle) ? calculatedAngle : 0;
    }
}
