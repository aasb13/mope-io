const BIOME_METADATA = Object.freeze({
    0: Object.freeze({ id: 0, name: 'Land', color: '#26A73A' }),
    1: Object.freeze({ id: 1, name: 'Ocean', color: '#1C91B8' }),
    2: Object.freeze({ id: 2, name: 'Arctic', color: '#B2B2B2' }),
    3: Object.freeze({ id: 3, name: 'Volcano', color: '#ff6000' }),
    4: Object.freeze({ id: 4, name: 'Desert', color: '#9F8641' }),
    5: Object.freeze({ id: 5, name: 'Forest', color: '#00db22' }),
});

const PLAYER_RELATION_LABELS = Object.freeze({
    dangerous: 'dangerous',
    edible: 'edible',
    tailBiter: 'tail-biter',
    edibleObject: 'edible-object',
});

const DEFAULT_ABILITY_IMAGE_BY_TYPE = Object.freeze({
    0x11: 'img/snowball.png',
    0x10: 'img/snowball.png',
    0x0e: 'img/ability_claw.png',
    0x13: 'img/fire.png',
    0x1e: 'img/fire.png',
    0x23: 'img/spiderWeb.png',
    0x33: 'img/ability_crabSmashSkin.png',
    0x36: 'skins/ostrich/ostrich-baby.png',
    0x53: 'skins/desert/camel/spit.png',
    0x65: 'img/ability_dive.png',
});

const CAMERA_LERP_WINDOW_MS = 175;

function getGameMetadataRoot() {
    return typeof unsafeWindow !== 'undefined'
        ? unsafeWindow
        : (typeof globalThis !== 'undefined' ? globalThis : window);
}

function getPacketParserStateObject() {
    const root = getGameMetadataRoot();
    return root.__mopePacketParserState && typeof root.__mopePacketParserState === 'object'
        ? root.__mopePacketParserState
        : {};
}

function getPacketParserState() {
    const root = getGameMetadataRoot();
    return root.__mopePacketParserState && typeof root.__mopePacketParserState === 'object'
        ? root.__mopePacketParserState
        : null;
}

function getEntityStore(state = getPacketParserStateObject()) {
    if (state && state.entities && typeof state.entities === 'object') {
        return state.entities;
    }

    return {};
}

function getStoredEntity(entityId, state = getPacketParserStateObject()) {
    if (!Number.isInteger(entityId)) {
        return null;
    }

    return getEntityStore(state)[entityId] || null;
}

function getCurrentPlayerEntity(state = getPacketParserStateObject()) {
    return getStoredEntity(state.playerId, state);
}

function getInterpolatedCameraState(state = getPacketParserStateObject(), nowMs = Date.now(), lerpWindowMs = CAMERA_LERP_WINDOW_MS) {
    if (!state || typeof state !== 'object') {
        return null;
    }

    const x = Number(state.cameraX);
    const y = Number(state.cameraY);
    const zoom = Number(state.cameraZoom);
    if (![x, y, zoom].every(Number.isFinite)) {
        return null;
    }

    const previousX = Number.isFinite(state.previousCameraX) ? state.previousCameraX : x;
    const previousY = Number.isFinite(state.previousCameraY) ? state.previousCameraY : y;
    const updateTime = Number.isFinite(state.cameraUpdateTime) ? state.cameraUpdateTime : nowMs;
    const progress = clampNumber((nowMs - updateTime) / lerpWindowMs, 0, 1);
    const smoothedZoom = getSmoothedCameraZoom(state, nowMs, zoom);

    return {
        x: lerpNumber(previousX, x, progress),
        y: lerpNumber(previousY, y, progress),
        zoom: smoothedZoom,
        progress,
        updateTime,
    };
}

function getSmoothedCameraZoom(state, nowMs, targetZoom) {
    if (!state || typeof state !== 'object' || !Number.isFinite(targetZoom)) {
        return targetZoom;
    }

    const frameIntervalMs = 1000 / 120;
    const zoomBlendRetainedPerFrame = 25 / 26;
    const lastUpdateMs = Number.isFinite(state.cameraZoomSmoothingTime)
        ? state.cameraZoomSmoothingTime
        : nowMs;
    const previousZoom = Number.isFinite(state.renderCameraZoom)
        ? state.renderCameraZoom
        : (Number.isFinite(state.previousCameraZoom) ? state.previousCameraZoom : targetZoom);
    const elapsedMs = Math.max(0, nowMs - lastUpdateMs);
    const frameSteps = Math.max(1, elapsedMs / frameIntervalMs);
    const retained = Math.pow(zoomBlendRetainedPerFrame, frameSteps);
    const nextZoom = targetZoom + (previousZoom - targetZoom) * retained;

    state.renderCameraZoom = nextZoom;
    state.cameraZoomSmoothingTime = nowMs;
    return nextZoom;
}

function getAnimalInfo(animalType) {
    if (typeof animalType !== 'number') {
        return null;
    }

    const generated = GeneratedAnimalMetadata[animalType] || {};
    const name = generated.name || AnimalType[animalType] || null;
    const description = generated.description || '';
    const upgradeText = typeof generated.upgradeText === 'string'
        ? generated.upgradeText
            .replaceAll('{aniName}', name || '')
            .replaceAll('{aniDesc}', description || '')
        : null;

    return {
        type: animalType,
        name,
        description,
        upgradeText,
        color: generated.color || null,
        skinName: generated.skinName || null,
    };
}

function getAnimalName(animalType) {
    const info = getAnimalInfo(animalType);
    return info ? info.name : null;
}

function getAnimalSkinName(record) {
    if (!record || typeof record !== 'object') {
        return null;
    }

    const animalType = typeof record.animalType === 'number'
        ? record.animalType
        : (typeof record.secondaryType === 'number' ? record.secondaryType : null);
    if (typeof animalType !== 'number') {
        return null;
    }

    switch (animalType) {
        case 0x2e: {
            const species = Number.isFinite(record.animalSpecies) ? record.animalSpecies : 0;
            return `volcano/blackdragon/${species}/blackdragon`;
        }
        case 0x3a: {
            const species = Number.isFinite(record.animalSpecies) ? record.animalSpecies : 0;
            const isAttacking = record.isAttacking === 1
                || record.extra?.isAttacking === 1
                || record.flag_usingAbility === true
                || record.flags?.flag_usingAbility === true;
            if (species === 0x2 && isAttacking) {
                return 'duck/2/duck1';
            }
            return `duck/${species}/duck`;
        }
        case 0x3b:
            return 'duck/duckling';
        case 0x43: {
            const subSpecies = Number.isFinite(record.animalSubSpecies) ? record.animalSubSpecies : 0;
            const variant = Number.isFinite(record.specType) && record.specType > 0 ? record.specType : '';
            return `honeybee/0/${subSpecies}/honeybee${variant}`;
        }
        case 0x44: {
            let speciesPath = Number.isFinite(record.animalSpecies) ? record.animalSpecies : 0;
            const subSpecies = Number.isFinite(record.animalSubSpecies) ? record.animalSubSpecies : 0;
            const variant = Number.isFinite(record.specType) && record.specType > 0 ? record.specType : '';
            if (speciesPath === 0xc8 || speciesPath === 0xce) {
                speciesPath = `${speciesPath}/${subSpecies}`;
            }
            return `volcano/phoenix/${speciesPath}/phoenix${variant}`;
        }
        case 0x46: {
            const species = Number.isFinite(record.animalSpecies) ? record.animalSpecies : 0;
            if (species === 0xdc && (Number.isFinite(record.animalSubSpecies) ? record.animalSubSpecies : 0) === 0) {
                return `ocean/seamonster/${species}/seamonster1`;
            }
            return `ocean/seamonster/${species}/seamonster`;
        }
        case 0x47: {
            const species = Number.isFinite(record.animalSpecies) ? record.animalSpecies : 0;
            const subSpecies = Number.isFinite(record.animalSubSpecies) ? record.animalSubSpecies : 0;
            if (subSpecies === 0) {
                return `volcano/landmonster/${species}/landmonster`;
            }
            if (subSpecies === 0xcc) {
                return `volcano/landmonster/${species}/${subSpecies}/landmonster1`;
            }
            return `volcano/landmonster/${species}/${subSpecies}/landmonster`;
        }
        case 0x48: {
            const species = Number.isFinite(record.animalSpecies) ? record.animalSpecies : 0;
            const spriteName = Number(record.entityId ?? record.id) === 0 ? 'ability' : 'icemonster';
            return `arctic/icemonster/${species}/${spriteName}`;
        }
        case 0x49: {
            const species = Number.isFinite(record.animalSpecies) ? record.animalSpecies : 0;
            return `land/dinomonster/${species}/dinomonster1`;
        }
        default:
            break;
    }

    const generated = getAnimalInfo(animalType);
    if (typeof generated?.skinName === 'string' && generated.skinName.length > 0) {
        return generated.skinName;
    }

    return null;
}

function getBiomeInfo(biomeId) {
    if (typeof biomeId !== 'number') {
        return null;
    }

    const metadata = BIOME_METADATA[biomeId];
    if (metadata) {
        return metadata;
    }

    return {
        id: biomeId,
        name: Biome[biomeId] || null,
        color: null,
    };
}

function getBiomeName(biomeId) {
    const info = getBiomeInfo(biomeId);
    return info ? info.name : null;
}

function getAbilityName(abilityType) {
    return typeof abilityType === 'number' ? (AbilityType[abilityType] || null) : null;
}

function getObjectTypeName(objectType) {
    return typeof objectType === 'number' ? (ObjectType[objectType] || null) : null;
}

function getObjectVariantName(variantType, category = null) {
    if (typeof variantType !== 'number') {
        return null;
    }

    if (
        typeof category === 'string'
        && ObjectVariantType[category]
        && typeof ObjectVariantType[category] === 'object'
    ) {
        return ObjectVariantType[category][variantType] || null;
    }

    const categories = Object.keys(ObjectVariantType);
    for (let index = 0; index < categories.length; index += 1) {
        const bucket = ObjectVariantType[categories[index]];
        if (bucket && Object.prototype.hasOwnProperty.call(bucket, variantType)) {
            return bucket[variantType];
        }
    }

    return null;
}

function getAbilityImagePath(abilityType, context = null) {
    if (typeof abilityType !== 'number') {
        return null;
    }

    const directImage = DEFAULT_ABILITY_IMAGE_BY_TYPE[abilityType];
    if (directImage) {
        return directImage;
    }

    const skinName = context && typeof context.skinName === 'string'
        ? context.skinName
        : (context && typeof context.animalSkinName === 'string' ? context.animalSkinName : null);

    if (!skinName) {
        return null;
    }

    if (abilityType === 0x02 || abilityType === 0x31) {
        return `skins/${skinName}2.png`;
    }

    if (abilityType === 0x18) {
        return `skins/0${skinName}.png`;
    }

    return `skins/${skinName}.png`;
}

function getAbilityInfo(abilityType, input = null, context = null) {
    if (typeof abilityType !== 'number') {
        return null;
    }

    const name = getAbilityName(abilityType);
    return {
        type: abilityType,
        name,
        displayName: name,
        input,
        imagePath: getAbilityImagePath(abilityType, context),
    };
}

function getPlayerAnimalRelations(animalType, state = getPacketParserStateObject()) {
    if (typeof animalType !== 'number') {
        return [];
    }

    const relations = [];
    if (state.dangerousAnimalTypes instanceof Set && state.dangerousAnimalTypes.has(animalType)) {
        relations.push(PLAYER_RELATION_LABELS.dangerous);
    }
    if (state.edibleAnimalTypes instanceof Set && state.edibleAnimalTypes.has(animalType)) {
        relations.push(PLAYER_RELATION_LABELS.edible);
    }
    if (state.tailBiterAnimalTypes instanceof Set && state.tailBiterAnimalTypes.has(animalType)) {
        relations.push(PLAYER_RELATION_LABELS.tailBiter);
    }
    return relations;
}

function getPlayerObjectRelations(objectType, state = getPacketParserStateObject()) {
    if (typeof objectType !== 'number') {
        return [];
    }

    if (state.edibleObjectTypes instanceof Set && state.edibleObjectTypes.has(objectType)) {
        return [PLAYER_RELATION_LABELS.edibleObject];
    }

    return [];
}

function getEntityPlayerRelations(record, state = getPacketParserStateObject()) {
    if (!record || typeof record !== 'object') {
        return [];
    }

    if (record.entityType === 0x02) {
        return getPlayerAnimalRelations(record.secondaryType ?? record.animalType, state);
    }

    return getPlayerObjectRelations(record.entityType, state);
}

function enrichAnimalRecord(record) {
    if (!record || typeof record !== 'object') {
        return record;
    }

    if (typeof record.animalType === 'number' && !Object.prototype.hasOwnProperty.call(record, 'animalMetadata')) {
        record.animalMetadata = getAnimalInfo(record.animalType);
    }

    if (typeof record.animalType === 'number' && !Object.prototype.hasOwnProperty.call(record, 'animalName')) {
        record.animalName = getAnimalName(record.animalType);
    }

    if (record.animalMetadata) {
        if (typeof record.animalSkinName !== 'string' || record.animalSkinName.length === 0) {
            record.animalSkinName = record.animalMetadata.skinName;
        }
        if (!Object.prototype.hasOwnProperty.call(record, 'animalColor')) {
            record.animalColor = record.animalMetadata.color;
        }
        if (!Object.prototype.hasOwnProperty.call(record, 'animalUpgradeText')) {
            record.animalUpgradeText = record.animalMetadata.upgradeText;
        }
    }

    const derivedAnimalSkinName = getAnimalSkinName(record);
    if (derivedAnimalSkinName) {
        record.animalSkinName = derivedAnimalSkinName;
    }

    if (
        typeof record.skinName === 'string'
        && record.skinName.length > 0
        && (typeof record.animalSkinName !== 'string' || record.animalSkinName.length === 0)
    ) {
        record.animalSkinName = record.skinName;
    }

    if (typeof record.upgradeText === 'string' && !Object.prototype.hasOwnProperty.call(record, 'animalUpgradeText')) {
        record.animalUpgradeText = record.upgradeText;
    }

    if (typeof record.biomeNum === 'number' && !Object.prototype.hasOwnProperty.call(record, 'biomeName')) {
        record.biomeName = getBiomeName(record.biomeNum);
    }

    if (typeof record.biomeNum === 'number' && !Object.prototype.hasOwnProperty.call(record, 'biomeInfo')) {
        record.biomeInfo = getBiomeInfo(record.biomeNum);
    }

    if (typeof record.curBiome === 'number' && !Object.prototype.hasOwnProperty.call(record, 'curBiomeName')) {
        record.curBiomeName = getBiomeName(record.curBiome);
    }

    if (typeof record.curBiome === 'number' && !Object.prototype.hasOwnProperty.call(record, 'curBiomeInfo')) {
        record.curBiomeInfo = getBiomeInfo(record.curBiome);
    }

    if (typeof record.animalHomeBiome === 'number' && !Object.prototype.hasOwnProperty.call(record, 'animalHomeBiomeName')) {
        record.animalHomeBiomeName = getBiomeName(record.animalHomeBiome);
    }

    if (typeof record.animalHomeBiome === 'number' && !Object.prototype.hasOwnProperty.call(record, 'animalHomeBiomeInfo')) {
        record.animalHomeBiomeInfo = getBiomeInfo(record.animalHomeBiome);
    }

    if (typeof record.primaryAbilityType === 'number' && !Object.prototype.hasOwnProperty.call(record, 'primaryAbility')) {
        record.primaryAbility = getAbilityInfo(record.primaryAbilityType, 'W', record);
        record.primaryAbilityName = record.primaryAbility ? record.primaryAbility.name : null;
        record.primaryAbilityImage = record.primaryAbility ? record.primaryAbility.imagePath : null;
    }

    if (typeof record.secondaryAbilityType === 'number' && !Object.prototype.hasOwnProperty.call(record, 'secondaryAbility')) {
        record.secondaryAbility = getAbilityInfo(record.secondaryAbilityType, 'S', record);
        record.secondaryAbilityName = record.secondaryAbility ? record.secondaryAbility.name : null;
        record.secondaryAbilityImage = record.secondaryAbility ? record.secondaryAbility.imagePath : null;
    }

    if (typeof record.abilityType === 'number' && !Object.prototype.hasOwnProperty.call(record, 'ability')) {
        record.ability = getAbilityInfo(record.abilityType, null, record);
        record.abilityName = record.ability ? record.ability.name : null;
        record.abilityImage = record.ability ? record.ability.imagePath : null;
    }

    if (typeof record.activeAbility === 'number' && !Object.prototype.hasOwnProperty.call(record, 'activeAbilityInfo')) {
        record.activeAbilityInfo = getAbilityInfo(record.activeAbility, null, record);
        record.activeAbilityName = record.activeAbilityInfo ? record.activeAbilityInfo.name : null;
        record.activeAbilityImage = record.activeAbilityInfo ? record.activeAbilityInfo.imagePath : null;
    }

    return record;
}

function enrichEntityRecord(record) {
    if (!record || typeof record !== 'object') {
        return record;
    }

    enrichAnimalRecord(record);

    if (typeof record.secondaryType === 'number' && record.entityType === 0x02 && !record.animalName) {
        record.animalType = record.secondaryType;
        record.animalName = getAnimalName(record.secondaryType);
    }

    if (!Object.prototype.hasOwnProperty.call(record, 'playerRelations')) {
        record.playerRelations = getEntityPlayerRelations(record);
    }

    if (!Object.prototype.hasOwnProperty.call(record, 'isDangerousToPlayer')) {
        record.isDangerousToPlayer = record.playerRelations.includes(PLAYER_RELATION_LABELS.dangerous);
    }

    if (!Object.prototype.hasOwnProperty.call(record, 'isEdibleToPlayer')) {
        record.isEdibleToPlayer = record.playerRelations.includes(PLAYER_RELATION_LABELS.edible);
    }

    if (!Object.prototype.hasOwnProperty.call(record, 'canTailBitePlayer')) {
        record.canTailBitePlayer = record.playerRelations.includes(PLAYER_RELATION_LABELS.tailBiter);
    }

    if (!Object.prototype.hasOwnProperty.call(record, 'isEdibleObjectForPlayer')) {
        record.isEdibleObjectForPlayer = record.playerRelations.includes(PLAYER_RELATION_LABELS.edibleObject);
    }

    return record;
}

function serializePacketParserStateSnapshot(state) {
    if (!state || typeof state !== 'object') {
        return {};
    }

    return {
        isAliveInGame: state.isAliveInGame ?? null,
        gameMode: state.gameMode ?? null,
        playerId: state.playerId ?? null,
        currentAnimalType: state.currentAnimalType ?? null,
        currentAnimalInfo: getAnimalInfo(state.currentAnimalType),
        currentAnimalName: getAnimalName(state.currentAnimalType),
        currentAnimalSpecies: state.currentAnimalSpecies ?? null,
        currentAnimal: state.currentAnimal ? serializeForLog(state.currentAnimal, new WeakSet(), 0) : null,
        currentAnimalTypeLists: state.currentAnimalTypeLists
            ? serializeForLog(state.currentAnimalTypeLists, new WeakSet(), 0)
            : [],
        dangerousAnimalTypes: state.dangerousAnimalTypes ? Array.from(state.dangerousAnimalTypes) : [],
        edibleAnimalTypes: state.edibleAnimalTypes ? Array.from(state.edibleAnimalTypes) : [],
        tailBiterAnimalTypes: state.tailBiterAnimalTypes ? Array.from(state.tailBiterAnimalTypes) : [],
        edibleObjectTypes: state.edibleObjectTypes ? Array.from(state.edibleObjectTypes) : [],
        entityCount: Object.keys(getEntityStore(state)).length,
        playerEntity: getCurrentPlayerEntity(state)
            ? serializeForLog(enrichEntityRecord({ ...getCurrentPlayerEntity(state) }), new WeakSet(), 0)
            : null,
        entities: serializeForLog(
            Object.fromEntries(
                Object.entries(getEntityStore(state)).map(([entityId, entity]) => [
                    entityId,
                    enrichEntityRecord({ ...entity }),
                ])
            ),
            new WeakSet(),
            0
        ),
        lastWorldState: Array.isArray(state.lastWorldState)
            ? serializeForLog(state.lastWorldState, new WeakSet(), 0)
            : [],
        lastOptionalSections: state.lastOptionalSections
            ? serializeForLog(state.lastOptionalSections, new WeakSet(), 0)
            : null,
        lastPlayerSection: state.lastPlayerSection
            ? serializeForLog(enrichEntityRecord({ ...state.lastPlayerSection }), new WeakSet(), 0)
            : null,
    };
}
