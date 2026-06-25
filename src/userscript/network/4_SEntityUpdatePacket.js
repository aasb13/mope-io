class EntityUpdatePacket extends Packet {
    constructor(view) {
        super(view, 1);

        const totalBytes = view.byteLength;
        const root = typeof unsafeWindow !== 'undefined'
            ? unsafeWindow
            : (typeof globalThis !== 'undefined' ? globalThis : window);
        if (!root.__mopePacketParserState || typeof root.__mopePacketParserState !== 'object') {
            root.__mopePacketParserState = {};
        }

        const state = root.__mopePacketParserState;
        if (!state.entities || typeof state.entities !== 'object') {
            state.entities = {};
        }

        const parseAttempt = (includeAliveSections) => {
            const packetUtil = new PacketUtil(view, 1);
            const readUInt8 = packetUtil.readUInt8.bind(packetUtil);
            const readUInt16 = packetUtil.readUInt16.bind(packetUtil);
            const readUInt32 = packetUtil.readUInt32.bind(packetUtil);
            const readInt16 = packetUtil.readInt16.bind(packetUtil);
            const readString = packetUtil.readString.bind(packetUtil);
            const readBitGroup = packetUtil.readBitGroup.bind(packetUtil);

            const entityState = {};
            for (const [entityId, entity] of Object.entries(state.entities)) {
                entityState[entityId] = { ...entity };
            }

            const result = {
                worldState: [],
                optionalSections: { trees: [], arena: [], worldFlags: null },
                newEntities: [],
                updatedEntities: [],
                removedEntities: [],
                trailingBytes: [],
                playerSection: null,
                parserMode: includeAliveSections ? 'withAliveSections' : 'withoutAliveSections',
                bytesParsed: 0,
                bytesRemaining: 0,
                totalBytes,
                parsingError: null,
            };

            const parseWorldStateItem = (type) => {
                switch (type) {
                    case 0x01:
                        return { type, value: readUInt16() / 1000 };
                    case 0x02:
                        return { type, x: readUInt32() / 100, y: readUInt32() / 100 };
                    case 0x03:
                        return { type, x: readUInt16() / 4, y: readUInt16() / 4 };
                    case 0x04: {
                        const packed = readUInt8();
                        return {
                            type,
                            raw: packed,
                            abil_possible: ((packed >> 1) & 0x01) === 1,
                            flag2: ((packed >> 2) & 0x01) === 1,
                            flag3: ((packed >> 3) & 0x01) === 1,
                            flag4: ((packed >> 4) & 0x01) === 1,
                            flag5: ((packed >> 5) & 0x01) === 1,
                            flag6: ((packed >> 6) & 0x01) === 1,
                            flag7: ((packed >> 7) & 0x01) === 1,
                        };
                    }
                    case 0x05: {
                        const packed = readUInt8();
                        return {
                            type,
                            raw: packed,
                            flag0: (packed & 0x01) === 1,
                            flag1: ((packed >> 1) & 0x01) === 1,
                            flag2: ((packed >> 2) & 0x01) === 1,
                            flag3: ((packed >> 3) & 0x01) === 1,
                            flag4: ((packed >> 4) & 0x01) === 1,
                        };
                    }
                    case 0x06: {
                        const packed = readUInt8();
                        return {
                            type,
                            raw: packed,
                            flag0: (packed & 0x01) === 1,
                            flag1: ((packed >> 1) & 0x01) === 1,
                            flag2: ((packed >> 2) & 0x01) === 1,
                            flag3: ((packed >> 3) & 0x01) === 1,
                            flag4: ((packed >> 4) & 0x01) === 1,
                        };
                    }
                    case 0x07:
                    case 0x0b:
                    case 0x0d:
                    case 0x11:
                        return { type, value: readUInt32() };
                    case 0x08:
                    case 0x0c:
                    case 0x0f:
                    case 0x10:
                    case 0x12:
                    case 0x14:
                    case 0x15:
                        return { type, value: readUInt8() };
                    case 0x09:
                        return { type, value: readUInt16() / 10 };
                    case 0x0a:
                        return { type, value: readUInt16() };
                    case 0x0e:
                        return { type, value: readString() };
                    case 0x13:
                        return { type, value: readUInt16() };
                    default:
                        throw new Error(`Unknown world state type 0x${type.toString(16)} at offset ${packetUtil.offset - 1}`);
                }
            };

            const parseWorldState = () => {
                const stateCount = readUInt8();
                const states = [];
                for (let i = 0; i < stateCount; i++) {
                    const type = readUInt8();
                    states.push(parseWorldStateItem(type));
                }
                return states;
            };

            const readIdListSection = () => {
                const enabled = readUInt8() === 1;
                const ids = [];
                if (enabled) {
                    const count = readUInt8();
                    for (let i = 0; i < count; i++) {
                        ids.push(readUInt32());
                    }
                }
                return ids;
            };

            const parseAliveSections = () => {
                const flags = readBitGroup();
                const worldFlags = {
                    _bytes: flags.bytes,
                    devMode: flags.getBool(),
                };

                if (worldFlags.devMode) {
                    worldFlags.showHitboxes = flags.getBool();
                    worldFlags.showDebug = flags.getBool();
                } else {
                    worldFlags.showHitboxes = false;
                    worldFlags.showDebug = false;
                }

                worldFlags.extra = flags.getBool();

                return {
                    worldFlags,
                    trees: readIdListSection(),
                    arena: readIdListSection(),
                };
            };

            const parseObjectFlags = () => {
                const bitGroup = readBitGroup();
                return {
                    _bytes: bitGroup.bytes,
                    flag_hurt: bitGroup.getBool(),
                    flag_flying: bitGroup.getBool(),
                };
            };

            const parsePlayerFlags = () => {
                const bitGroup = readBitGroup();
                const flags = {
                    _bytes: bitGroup.bytes,
                    flag_hurt: bitGroup.getBool(),
                    flag_flying: bitGroup.getBool(),
                    flag_lowWat: bitGroup.getBool(),
                    flag_underWater: bitGroup.getBool(),
                    flag_usingDiveAbility: bitGroup.getBool(),
                    flag_eff_invincible: bitGroup.getBool(),
                    flag_usingAbility: bitGroup.getBool(),
                    flag_tailBitten: bitGroup.getBool(),
                    flag_eff_stunned: bitGroup.getBool(),
                    flag_iceSliding: bitGroup.getBool(),
                    flag_eff_frozen: bitGroup.getBool(),
                    flag_eff_onFire: bitGroup.getBool(),
                    flag_eff_healing: bitGroup.getBool(),
                    flag_eff_poison: bitGroup.getBool(),
                    flag_constricted: bitGroup.getBool(),
                    flag_webStuck: bitGroup.getBool(),
                    flag_stealth: bitGroup.getBool(),
                    flag_eff_bleeding: bitGroup.getBool(),
                    flag_flying_extra: bitGroup.getBool(),
                    flag_isGrabbed: bitGroup.getBool(),
                    flag_eff_aniInClaws: bitGroup.getBool(),
                    flag_eff_stunk: bitGroup.getBool(),
                    flag_cold: bitGroup.getBool(),
                    flag_inWater: bitGroup.getBool(),
                    flag_inLava: bitGroup.getBool(),
                    flag_canClimbHill: bitGroup.getBool(),
                    flag_isClimbingHill: bitGroup.getBool(),
                    flag_isDevMode: bitGroup.getBool(),
                    flag_eff_slimed: bitGroup.getBool(),
                    flag_eff_wobbling: bitGroup.getBool(),
                    flag_eff_hot: bitGroup.getBool(),
                    flag_eff_sweatPoisoned: bitGroup.getBool(),
                    flag_eff_shivering: bitGroup.getBool(),
                    flag_inHidingHole: bitGroup.getBool(),
                    flag_eff_grabbedByFlytrap: bitGroup.getBool(),
                    flag_eff_aloeveraHealing: bitGroup.getBool(),
                    flag_eff_tossedInAir: bitGroup.getBool(),
                    flag_eff_isOnSpiderWeb: bitGroup.getBool(),
                    flag_fliesLikeDragon: bitGroup.getBool(),
                    flag_eff_isInMud: bitGroup.getBool(),
                    flag_eff_statue: bitGroup.getBool(),
                    flag_eff_isOnTree: bitGroup.getBool(),
                    flag_eff_isUnderTree: bitGroup.getBool(),
                    flag_speared: bitGroup.getBool(),
                    flag_eff_dirty: bitGroup.getBool(),
                    flag_eff_virusInfection: bitGroup.getBool(),
                    flag_eff_wearingMask: bitGroup.getBool(),
                    flag_eff_sanitized: bitGroup.getBool(),
                    flag_viewing1v1Invite: bitGroup.getBool(),
                    flag_can1v1: bitGroup.getBool(),
                    flag_isInArena: bitGroup.getBool(),
                };

                if (flags.flag_isDevMode) {
                    flags.flag_hideDevPrint = bitGroup.getBool();
                }
                flags.flag_eff_electroStun = bitGroup.getBool();
                return flags;
            };

            const getEntityKey = (entity) => `${entity.entityType}:${entity.secondaryType != null ? entity.secondaryType : ''}`;
            const isAnimal = (entity) => entity.entityType === 0x02;
            const hasSecondaryType = (entityType) => entityType === 0x02 || entityType === 0x75 || entityType === 0x0e || entityType === 0x80;

            const readSantaInfo = () => ({
                curRad: readUInt16() / 100,
                x1: readUInt16() / 4,
                y1: readUInt16() / 4,
                x2: readUInt16() / 4,
                y2: readUInt16() / 4,
            });

            const readSpiderWebInfo = () => ({
                curRad: readUInt16() / 100,
                webX: readUInt16() / 4,
                webY: readUInt16() / 4,
                spiderX: readUInt16() / 4,
                spiderY: readUInt16() / 4,
            });

            const readCrystalInfo = () => {
                const count = readUInt8();
                const crystals = [];
                for (let i = 0; i < count; i++) {
                    crystals.push({
                        x: readInt16() / 100,
                        y: readInt16() / 100,
                        radius: readInt16() / 100,
                        angle: readUInt8() * 4,
                        isReady: readUInt8() === 1,
                    });
                }
                return crystals;
            };

            const readDisguiseInfo = (isAnimalDisguiseFlag = false) => {
                const enabled = readUInt8() > 0;
                if (!enabled) {
                    return { enabled };
                }

                if (isAnimalDisguiseFlag) {
                    return {
                        enabled,
                        isAnimal: readUInt8() > 0,
                        value: readUInt16(),
                    };
                }

                return {
                    enabled,
                    animalType: readUInt16(),
                    animalSpecies: readUInt16(),
                };
            };

            const readTerrainBitGroup = () => {
                const group = readBitGroup();
                return {
                    _bytes: group.bytes,
                    forceBiomeColor: group.getBool(),
                    jaggedSideTop: group.getBool(),
                    jaggedSideRight: group.getBool(),
                    jaggedSideBottom: group.getBool(),
                    jaggedSideLeft: group.getBool(),
                };
            };

            const looksLikeTerrainPayload = (startOffset) => {
                if (startOffset + 3 > totalBytes) {
                    return false;
                }

                const isRectByte = view.getUint8(startOffset);
                if (isRectByte !== 0x00 && isRectByte !== 0x01) {
                    return false;
                }

                const stringLength = view.getUint16(startOffset + 1, false);
                if (stringLength < 2 || stringLength > 32) {
                    return false;
                }

                const stringStart = startOffset + 3;
                const stringEnd = stringStart + stringLength;
                if (stringEnd + 2 > totalBytes) {
                    return false;
                }

                const firstChar = view.getUint8(stringStart);
                return (
                    firstChar === 0x23
                    || (firstChar >= 0x30 && firstChar <= 0x39)
                    || (firstChar >= 0x41 && firstChar <= 0x5a)
                    || (firstChar >= 0x61 && firstChar <= 0x7a)
                );
            };

            const readTerrainData = () => {
                const extras = {};

                if (!looksLikeTerrainPayload(packetUtil.offset)) {
                    for (let skip = 1; skip <= 4; skip++) {
                        if (!looksLikeTerrainPayload(packetUtil.offset + skip)) {
                            continue;
                        }

                        extras.terrainPrelude = [];
                        for (let i = 0; i < skip; i++) {
                            extras.terrainPrelude.push(readUInt8());
                        }
                        break;
                    }
                }

                extras.isRect = readUInt8() === 1;
                extras.biomeColor = readString();
                extras.biome = readUInt16();
                extras.terrainFlags = readTerrainBitGroup();
                return extras;
            };

            const readPromptData = () => {
                const title = readString();
                const invitedBy = readString();
                const time = readUInt8();
                const flags = readBitGroup();
                const watr = flags.getBool();
                const hp = flags.getBool();
                const speed = flags.getBool();
                const wall = flags.getBool();
                const climax = flags.getBool();
                let bites = 0;
                if (!climax) {
                    bites = readUInt8();
                }
                return { title, invitedBy, time, watr, hp, speed, wall, climax, bites, flagsBytes: flags.bytes };
            };

            const readWebAnchorInfo = () => {
                const webAnchorActive = readUInt8() === 1;
                const info = { webAnchorActive };
                if (webAnchorActive) {
                    info.webX = readUInt16() / 4;
                    info.webY = readUInt16() / 4;
                    info.spiderX = readUInt16() / 4;
                    info.spiderY = readUInt16() / 4;
                }
                return info;
            };

            const readEntitySpecificNewData = (entity) => {
                const extras = {};

                // oType 0x2a (_0x24252c): custom newly-visible data
                // assets/deobf.js: _0x24252c.prototype.readCustomData_onNewlyVisible
                if (entity.entityType === 0x2a) {
                    extras.maxLvl = readUInt8() / 10;
                    extras.shakeStart = readUInt8() / 10;
                    extras.shakeEnd = readUInt8() / 10;
                    extras.eruption = readUInt16() / 100;
                    return extras;
                }

                if (entity.entityType === 0x75) {
                    extras.segmentNum = readUInt8();
                    extras.animalSpecies = readUInt8();
                    extras.animalSubSpecies = readUInt8();
                    extras.animalPremiumSkin = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x39) {
                    extras.webTransparency = readUInt8();
                    extras.webType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x42) {
                    extras.mommyID = readUInt32();
                    extras.speciesType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x46 || entity.entityType === 0x12) {
                    extras.speciesType = readUInt16();
                    extras.speciesSubType = readUInt16();
                    return extras;
                }

                if (entity.entityType === 0x4b) {
                    extras.chilliType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x4c) {
                    extras.shrinkRadius = readUInt32() / 4;
                    return extras;
                }

                if (entity.entityType === 0x4a) {
                    extras.spawnedFromDeadAni = readUInt8() === 1;
                    extras.animalType = readUInt16();
                    extras.animalHomeBiome = readUInt8();
                    extras.nickName = readString();
                    extras.fadeAway = readUInt8() === 1;
                    if (extras.fadeAway) {
                        extras.webTransparency = readUInt16();
                    }
                    return extras;
                }

                if (entity.entityType === 0x50) {
                    extras.speciesType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x58) {
                    const flags = readBitGroup();
                    extras.attackFlags = {
                        _bytes: flags.bytes,
                        isAttacking: flags.getBool(),
                        isMouthClosed: flags.getBool(),
                        grabbedAni: flags.getBool(),
                    };
                    extras.anchorX = readUInt16() / 4;
                    extras.anchorY = readUInt16() / 4;
                    return extras;
                }

                if (entity.entityType === 0x64) {
                    extras.isOasisWater = readUInt8() === 1;
                    if (extras.isOasisWater) {
                        extras.radius = readUInt16() / 10;
                    }
                    return extras;
                }

                if (entity.entityType === 0x65) {
                    extras.foodType = readUInt16();
                    extras.canopy = readUInt8() === 1;
                    extras.eventType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x67) {
                    extras.showDevilFace = readUInt8() === 1;
                    return extras;
                }

                if (entity.entityType === 0x69 || (entity.entityType === 0x0e && (entity.secondaryType === 0x66 || entity.secondaryType === 0x68 || entity.secondaryType === 0x69 || entity.secondaryType === 0x91))) {
                    extras.alpha = readUInt8() / 100;
                    return extras;
                }

                if (entity.entityType === 0x6a) {
                    extras.isSnowFlake = readUInt8() === 1;
                    extras.isStickingOnObject = readUInt8() === 1;
                    extras.stickingOnObjectId = readUInt32();
                    return extras;
                }

                if (entity.entityType === 0x7d || entity.entityType === 0x8e) {
                    extras.foodType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x80 && entity.secondaryType === 0x02) {
                    extras.base1X = readUInt32() / 100;
                    extras.base1Y = readUInt32() / 100;
                    extras.base2X = readUInt32() / 100;
                    extras.base2Y = readUInt32() / 100;
                    return extras;
                }

                if (entity.entityType === 0x80 && entity.secondaryType === 0x03) {
                    extras.stretch = readUInt32() / 100;
                    return extras;
                }

                if (entity.entityType === 0x82) {
                    extras.prompt = readPromptData();
                    return extras;
                }

                if (entity.entityType === 0x83) {
                    extras.isRolling = readUInt8() === 1;
                    extras.pumpkinType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x8f) {
                    extras.giftColor = readUInt8();
                    extras.giftType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x90) {
                    extras.floaterType = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x91) {
                    extras.isRolling = readUInt8() === 1;
                    extras.pumpkinType = readUInt8();
                    extras.isFloating = readUInt8() === 1;
                    return extras;
                }

                if (entity.entityType === 0x92) {
                    extras.isClosed = readUInt8() === 1;
                    extras.umbrellaType = readUInt8();
                    extras.umbrellaColor = readUInt8();
                    return extras;
                }

                if (entity.entityType === 0x9a) {
                    extras.hasImpact = readUInt8() === 1;
                    extras.shadowDistance = readUInt16() / 10;
                    return extras;
                }

                if (entity.entityType === 0x9f) {
                    extras.speciesType = readUInt16();
                    extras.speciesSubType = readUInt16();
                    return extras;
                }

                if (entity.entityType === 0xa5) {
                    extras.biomeType = readUInt8();
                    extras.isRolling = readUInt8() === 1;
                    extras.isFloating = readUInt8() === 1;
                    return extras;
                }

                if (entity.entityType === 0x28) {
                    entity.isRectangle = true;
                    entity.clientBatchDraw = true;
                    entity.rad = undefined;
                    entity.rectW = readUInt16();
                    entity.rectH = readUInt16();
                    entity.curBiome = readUInt8();
                    entity.clientBatchDrawID = readUInt16();
                    entity.specType = readUInt8();
                    extras.riverStreamHeight = readUInt16();
                    extras.isFloatingRiver = readUInt8() === 1;
                    extras.riverSize = readUInt16() / 1000;
                    return extras;
                }

                if (entity.entityType === 0x0a) {
                    extras.isEmptyLake = readUInt8() === 1;
                    extras.isDeathLake = readUInt8() === 1;
                    extras.lakeSize = readUInt16() / 1000;
                    if (extras.isDeathLake) {
                        extras.poison = readUInt16() / 1000;
                        extras.lakeStream = readUInt16();
                    }
                    return extras;
                }

                if (entity.entityType === 0x93) {
                    return readTerrainData();
                }

                if (entity.entityType === 0x0e) {
                    entity.specType = readUInt8();
                    entity.specType2 = readUInt8();
                    entity.skinThemeID = readUInt8();
                    entity.mopeSeasonID = readUInt8();

                    switch (entity.secondaryType) {
                        case 0x3b:
                            extras.hasTimer = readUInt8() === 1;
                            extras.isGreenTarget = readUInt8() === 1;
                            extras.targetText = readString();
                            return extras;
                        case 0x3e:
                            extras.aniSpecies = readUInt8();
                            return extras;
                        case 0x44:
                            extras.fightType = readUInt8();
                            extras.arenaState = readUInt8();
                            extras.rounds = readUInt8();
                            extras.p1 = readString();
                            extras.p2 = readString();
                            extras.arenaModeType = readUInt8();
                            extras.p1Wins = readUInt8();
                            extras.p2Wins = readUInt8();
                            extras.fightNumber = readUInt16();
                            extras.arenaRadius = readUInt16() / 100;
                            extras.climaxType = readUInt8();
                            if (extras.climaxType === 0x02) {
                                extras.maxBitesToWin = readUInt8();
                            }
                            extras.canPush = readUInt8() === 1;
                            extras.canDash = readUInt8() === 1;
                            return extras;
                        case 0x65:
                            extras.alpha = readUInt8() / 100;
                            return extras;
                        case 0x68:
                            extras.alpha = readUInt8() / 100;
                            return extras;
                        case 0x69:
                            extras.alpha = readUInt8() / 100;
                            return extras;
                        case 0x70:
                            extras.spearState = readUInt8();
                            extras.victimID = readUInt32();
                            extras.effect_flying = readUInt8() === 1;
                            return extras;
                        case 0x80:
                            extras.chat = 'CAW!!!';
                            return extras;
                        case 0x90:
                            return extras;
                        case 0x91:
                            extras.alpha = readUInt8() / 100;
                            return extras;
                        default:
                            return extras;
                    }
                }

                if (!isAnimal(entity)) {
                    return extras;
                }

                switch (entity.secondaryType) {
                    case 0x0b:
                        extras.isCamouflage = readUInt8() === 1;
                        break;
                    case 0x1d:
                        extras.disguise = readDisguiseInfo(true);
                        break;
                    case 0x37:
                        extras.mommyID = readUInt32();
                        break;
                    case 0x3a:
                        extras.isAttacking = readUInt8();
                        break;
                    case 0x45:
                        extras.mommyID = readUInt32();
                        break;
                    case 0x4d:
                        extras.colorPerc = readUInt8() / 100;
                        break;
                    case 0x5e:
                        extras.isLicking = readUInt8() === 1;
                        extras.lickSide = readUInt8();
                        extras.lickedAmt = readUInt8();
                        break;
                    case 0x5f:
                        extras.poison = readUInt8();
                        break;
                    case 0x60:
                        extras.isGliding = readUInt8() === 1;
                        break;
                    case 0x62:
                        extras.webState = readUInt8();
                        break;
                    case 0x65:
                        extras.isTransforming = readUInt8() === 1;
                        extras.isCamouflage = readUInt8() === 1;
                        extras.carrotAlpha = readUInt16() / 1000;
                        extras.lights = readUInt8();
                        break;
                    case 0x44:
                        extras.speciesType = readUInt16();
                        extras.speciesSubType = readUInt16();
                        break;
                    case 0x47:
                        extras.crystals = readCrystalInfo();
                        break;
                    case 0x49:
                        break;
                    case 0x4b:
                        extras.canUseTailslap = readUInt8() === 1;
                        extras.tailState = readUInt16() / 100;
                        break;
                    case 0x55:
                        extras.isCharging = readUInt8() === 1;
                        break;
                    case 0x57:
                        break;
                    case 0x59:
                        extras.isCharging = readUInt8() === 1;
                        break;
                    case 0x61:
                        extras.isOasisWater = readUInt8() === 1;
                        if (extras.isOasisWater) {
                            extras.radius = readUInt16() / 10;
                        }
                        break;
                    case 0x6e:
                        extras.isAttacking = readBitGroup().getBool();
                        break;
                    case 0x80:
                        extras.chat = 'CAW!!!';
                        break;
                    default:
                        break;
                }

                if (entity.secondaryType === 0x47) {
                    return extras;
                }

                if (entity.secondaryType === 0x3b) {
                    return extras;
                }

                if (entity.secondaryType === 0x62) {
                    return extras;
                }

                return extras;
            };

            const parseNewEntity = () => {
                const nowMs = Date.now();
                const entity = {
                    startOffset: packetUtil.offset,
                    entityType: readUInt16(),
                    secondaryType: null,
                };

                if (hasSecondaryType(entity.entityType)) {
                    entity.secondaryType = readUInt16();
                }

                if (entity.entityType === 0x28) {
                    entity.entityId = readUInt32();
                    entity.x = readUInt16() / 4;
                    entity.y = readUInt16() / 4;
                    entity.ox = entity.x;
                    entity.oy = entity.y;
                    entity.nx = entity.x;
                    entity.ny = entity.y;
                    entity.updateTime = nowMs;
                    entity.extra = readEntitySpecificNewData(entity);
                    entity.endOffset = packetUtil.offset;
                    return entity;
                }

                if (entity.entityType === 0x0e && entity.secondaryType === 0x3b) {
                    entity.entityId = readUInt32();
                    entity.rad = readUInt16() / 4;
                    entity.x = readUInt16() / 4;
                    entity.y = readUInt16() / 4;
                    entity.ox = entity.x;
                    entity.oy = entity.y;
                    entity.nx = entity.x;
                    entity.ny = entity.y;
                    entity.updateTime = nowMs;
                    entity.extra = readEntitySpecificNewData(entity);
                    entity.endOffset = packetUtil.offset;
                    return entity;
                }

                entity.entityId = readUInt32();
                entity.rad = readUInt32() / 4;
                entity.x = readUInt16() / 4;
                entity.y = readUInt16() / 4;
                entity.ox = entity.x;
                entity.oy = entity.y;
                entity.nx = entity.x;
                entity.ny = entity.y;
                entity.updateTime = nowMs;
                entity.curBiome = readUInt8();

                if (!isAnimal(entity)) {
                    entity.mopeSeasonID = readUInt8();
                    entity.animalType = readUInt16();
                    entity.speciesType = readUInt16();
                    entity.speciesSubType = readUInt16();
                }

                const flags = readBitGroup();
                entity.flags = {
                    _bytes: flags.bytes,
                    spawnedByID: flags.getBool(),
                    isRectangle: flags.getBool(),
                    objGetsAngleUpdate: flags.getBool(),
                    clientBatchDraw: flags.getBool(),
                };

                if (entity.flags.clientBatchDraw) {
                    entity.clientBatchDrawID = readUInt16();
                }
                if (entity.flags.spawnedByID) {
                    entity.spawnedByID = readUInt32();
                }

                if (entity.flags.isRectangle) {
                    entity.rectW = readUInt16();
                    entity.rectH = readUInt16();
                } else {
                    entity.angleByte = readUInt8();
                }

                entity.specType = readUInt8();
                entity.specType2 = readUInt8();

                if (entity.entityType === 0x05 || entity.entityType === 0x09 || entity.entityType === 0x0d) {
                    entity.innerRad = readUInt16() / 4;
                }

                if (isAnimal(entity)) {
                    entity.nickName = readString();
                    entity.animalSpecies = readUInt16();
                    entity.animalSubSpecies = readUInt16();
                    entity.animalPremiumSkin = readUInt8();
                    entity.skinThemeID = readUInt8();
                    entity.mopeSeasonID = readUInt8();
                    entity.isVip = readUInt8();
                    entity.playerFlags = parsePlayerFlags();

                    if (entity.playerFlags.flag_webStuck) {
                        entity.effWebStuckType = readUInt8();
                    }
                    if (entity.playerFlags.flag_isInArena) {
                        entity.playerNumberFor1v1Arena = readUInt8();
                    }
                    if (entity.playerFlags.flag_isDevMode) {
                        entity.devModeNum = readUInt8();
                    }
                    entity.wins1v1 = readUInt16();
                    entity.teamID = readUInt8();
                }

                const extra = readEntitySpecificNewData(entity);
                if (Object.keys(extra).length > 0) {
                    entity.extra = extra;
                }

                entity.endOffset = packetUtil.offset;
                return entity;
            };

            const parseBaseProperty = (propertyId, entity) => {
                if (propertyId === 0x08 && entity.entityType === 0x4a) {
                    return { isFlying: readUInt8() === 1 };
                }

                if (propertyId === 0x0e && (entity.entityType === 0x8a || entity.entityType === 0x8c)) {
                    const timeLeft = readUInt16() / 100;
                    return { timeLeft, timerAngle: timeLeft / 100 };
                }

                if (propertyId === 0x0f && entity.entityType === 0x0a) {
                    return { lakeSize: readUInt16() / 1000 };
                }

                if (propertyId === 0x10 && entity.entityType === 0x0a) {
                    return { poison: readUInt16() / 1000 };
                }

                if (propertyId === 0x11) {
                    if (entity.entityType === 0x83 || entity.entityType === 0x91 || entity.entityType === 0xa5) {
                        return { isRolling: readUInt8() === 1 };
                    }
                    if (entity.entityType === 0x92) {
                        return { isClosed: readUInt8() === 0 };
                    }
                }

                if (propertyId === 0x12 && entity.entityType === 0x90) {
                    return { isFloatingInWater: readUInt8() === 1 };
                }

                if (propertyId === 0x0a && entity.entityType === 0x28) {
                    return { riverSize: readUInt16() / 1000 };
                }

                if (propertyId === 0x15 && entity.entityType === 0x4a) {
                    return { webTransparency: readUInt16() };
                }

                if (propertyId === 0x1a && entity.entityType === 0x97) {
                    return { hasPopped: readUInt8() };
                }

                if (propertyId === 0x1c && entity.entityType === 0x7b) {
                    return { stickyVirus: readUInt8() === 1 };
                }

                if (propertyId === 0x21) {
                    if (entity.entityType === 0x75) {
                        return { webTransparency: readUInt8() };
                    }
                    if (entity.entityType === 0x0e && entity.secondaryType === 0x5c) {
                        return { webAlpha: readUInt8() / 100 };
                    }
                }

                if (entity.entityType === 0x0e && entity.secondaryType === 0x70) {
                    switch (propertyId) {
                        case 0x22:
                            return { spearState: readUInt8() };
                        case 0x23:
                            return { victimId: readUInt32() };
                        case 0x25:
                            return { effectFlying: readUInt8() === 1 };
                        default:
                            break;
                    }
                }

                if (entity.entityType === 0x0e && entity.secondaryType === 0x44) {
                    switch (propertyId) {
                        case 0x27:
                            return { arenaState: readUInt8() };
                        case 0x28:
                            return { rounds: readUInt8() };
                        case 0x29:
                            return { timer: readUInt16() / 100, isCountdownTimer: true };
                        case 0x2a:
                            return { timer: readUInt16() / 100, isCountdownTimer: false };
                        case 0x2b: {
                            const timeLeft = readUInt16();
                            return { timeLeft, timerAngle: timeLeft / 1000 };
                        }
                        case 0x2c:
                            return { showTimerAngle: readUInt8() === 1 };
                        case 0x2d:
                            return { isArenaClosing: readUInt8() === 1 };
                        case 0x2e: {
                            const arenaTimeoutLeft = readUInt16();
                            return { arenaTimeoutLeft, timeoutAngle: arenaTimeoutLeft / 1000 };
                        }
                        case 0x2f:
                            return { arenaRadius: readUInt16() / 100 };
                        case 0x30:
                            return { winner: readUInt8() };
                        case 0x31:
                            return { winnerMsg: readString() };
                        case 0x32:
                            return { p1Bites: readUInt8() };
                        case 0x33:
                            return { p2Bites: readUInt8() };
                        case 0x34:
                            return { winBonus: readUInt32() };
                        case 0x35:
                            return { roundsWonP1: readUInt8() };
                        case 0x36:
                            return { roundsWonP2: readUInt8() };
                        case 0x37:
                            return { p1Wins: readUInt8() };
                        case 0x38:
                            return { p2Wins: readUInt8() };
                        case 0x39:
                            return { p1: readString() };
                        case 0x3a:
                            return { p2: readString() };
                        case 0x3b:
                            return { resetArena: readUInt8() === 1 };
                        case 0x3c:
                            return { fightNumber: readUInt16() };
                        case 0x3d:
                            return { player1DarkTheme: readUInt8() === 1 };
                        case 0x3e:
                            return { player2DarkTheme: readUInt8() === 1 };
                        default:
                            break;
                    }
                }

                if (propertyId === 0x60 && entity.entityType === 0x4c) {
                    return { shrinkRadius: readUInt32() / 4 };
                }

                if (propertyId === 0x76 && entity.entityType === 0x0a) {
                    return { isEmptyLake: readUInt8() === 1 };
                }

                switch (propertyId) {
                    case 0x01: {
                        const value = {
                            x: readUInt16() / 4,
                            y: readUInt16() / 4,
                        };

                        if (entity.entityType === 0x62) {
                            Object.assign(value, readWebAnchorInfo());
                        }

                        if (isAnimal(entity) && entity.secondaryType === 0x62) {
                            Object.assign(value, readWebAnchorInfo());
                        }

                        return value;
                    }
                    case 0x02:
                        return { radius: readUInt16() / 10 };
                    case 0x03:
                        return { angleDegrees: readUInt16() / 182 };
                    case 0x04:
                        return { hp: readUInt8() };
                    case 0x05:
                        return { hurt: readUInt8() === 1 };
                    case 0x06:
                        return { specType: readUInt8() };
                    case 0x07:
                        return { specType2: readUInt8() };
                    case 0x12:
                        return { isFloatingInWater: readUInt8() === 1 };
                    case 0x13:
                        return { lights: readUInt8() };
                    case 0x14:
                        return { eruption: readUInt16() / 100 };
                    case 0x16:
                        return { isAttacking: readUInt8() === 1 };
                    case 0x17:
                        return { isMouthClosed: readUInt8() === 1 };
                    case 0x18:
                        return { grabbedAni: readUInt8() === 1 };
                    case 0x1b:
                        return { timer: readUInt16() / 100 };
                    case 0x20:
                        return { timer: readUInt8() };
                    case 0x24:
                        return { radius: readUInt16() / 10 };
                    case 0x26:
                        return { alpha: readUInt8() / 100 };
                    case 0x3f:
                        return { wins1v1: readUInt16() };
                    case 0x40:
                        return { devModeNum: readUInt8() };
                    case 0x41:
                        return { playerNumberFor1v1Arena: readUInt8() };
                    case 0x42:
                        return { curBiome: readUInt8() };
                    case 0x43:
                        return { diveType: readUInt8() };
                    case 0x44:
                        return { statueType: readUInt8() };
                    case 0x45:
                        return { constrictedSpecies: readUInt16() };
                    case 0x46:
                        return { webStuckType: readUInt8() };
                    case 0x47:
                        return { dirtType: readUInt8() };
                    case 0x48:
                        return { infectionPercent: readUInt8() };
                    case 0x49:
                        return { hidingHoleId: readUInt32(), hidingHoleVisibilityRadius: readUInt16() / 4 };
                    case 0x4a:
                        return { sanitizedPercent: readUInt8() };
                    case 0x4b:
                        return { canUseTailslap: readUInt8() === 1 };
                    case 0x4c:
                        return { tailState: readUInt16() / 100 };
                    case 0x4d:
                        return { lava: readUInt8() };
                    case 0x4e:
                    case 0x4f:
                    case 0x50:
                    case 0x51:
                    case 0x52:
                    case 0x53:
                    case 0x54:
                        return { crystalRadius: readInt16() / 100, isReady: readUInt8() === 1 };
                    case 0x55:
                        return { isTransforming: readUInt8() === 1 };
                    case 0x56:
                        return { isCamouflage: readUInt8() === 1 };
                    case 0x57:
                        return { carrotAlpha: readUInt16() / 1000 };
                    case 0x58:
                        return { lights: readUInt8() };
                    case 0x59:
                        return { value: readUInt8() };
                    case 0x5a:
                        return { enabled: readUInt8() === 1 };
                    case 0x5b:
                        return { value: readUInt8() };
                    case 0x5c:
                        return { enabled: readUInt8() === 1 };
                    case 0x5d:
                        return { colorPercent: readUInt8() / 100 };
                    case 0x5e: {
                        if (isAnimal(entity) && entity.secondaryType === 0x1d) {
                            return { disguise: readDisguiseInfo(true) };
                        }
                        return { disguise: readDisguiseInfo(false) };
                    }
                    case 0x61:
                    case 0x62:
                    case 0x63:
                    case 0x64:
                    case 0x66:
                        return { x: readUInt16() / 4, y: readUInt16() / 4 };
                    case 0x65:
                        return { text: readString() };
                    case 0x67:
                        return { webState: readUInt8() };
                    case 0x6c:
                    case 0x6d:
                    case 0x70:
                        return { value: readUInt8() };
                    case 0x6e:
                        return { shadowDistance: readUInt16() / 10 };
                    case 0x6f:
                        return { hasImpact: readUInt8() === 1 };
                    case 0x71:
                        return { coolDownTime: readUInt16() / 100 };
                    case 0x72:
                    case 0x73:
                    case 0x74:
                    case 0x77:
                    case 0x79:
                        return { value: readUInt8() === 1 };
                    case 0x75:
                        return { targetId: readUInt32() };
                    case 0x78:
                        return { constrictedSubSpecies: readUInt16() };
                    case 0x7a:
                        return { activeAbility: readUInt16() };
                    default:
                        throw new Error(`Unknown updated property 0x${propertyId.toString(16)} for entityType 0x${entity.entityType.toString(16)} at offset ${packetUtil.offset}`);
                }
            };

            const parseUpdatedProperty = (propertyId, entity) => {
                const value = parseBaseProperty(propertyId, entity);

                if (propertyId === 0x59 && isAnimal(entity)) {
                    if (entity.secondaryType === 0x5e) {
                        value.lickedAmt = value.value;
                    } else if (entity.secondaryType === 0x5f) {
                        value.poison = value.value;
                    }
                }

                if (propertyId === 0x5b && isAnimal(entity) && entity.secondaryType === 0x5e) {
                    value.lickSide = value.value;
                }

                if (propertyId === 0x5c && isAnimal(entity) && entity.secondaryType === 0x59) {
                    value.isCharging = value.enabled;
                }

                if (propertyId === 0x66 && entity.entityType === 0x0e && entity.secondaryType === 0x3b) {
                    value.victimX = value.x;
                    value.victimY = value.y;
                }

                if (propertyId === 0x66 && isAnimal(entity)) {
                    value.devTargetX = value.x;
                    value.devTargetY = value.y;
                }

                if (propertyId >= 0x61 && propertyId <= 0x64 && entity.entityType === 0x0e && entity.secondaryType === 0x70) {
                    value.segment = propertyId - 0x60;
                }

                if (propertyId >= 0x4e && propertyId <= 0x54 && isAnimal(entity) && entity.secondaryType === 0x47) {
                    value.crystalIndex = propertyId - 0x4e;
                }

                return value;
            };

            const parseEntityUpdate = () => {
                const nowMs = Date.now();
                const entityId = readUInt32();
                const entity = entityState[entityId] || { entityType: -1, secondaryType: null };
                const currentPosition = calculateEntityInterpolatedPosition(entity, nowMs);
                const previousX = currentPosition && Number.isFinite(currentPosition.x)
                    ? currentPosition.x
                    : (Number.isFinite(entity.x) ? entity.x : null);
                const previousY = currentPosition && Number.isFinite(currentPosition.y)
                    ? currentPosition.y
                    : (Number.isFinite(entity.y) ? entity.y : null);
                const updateFlags = isAnimal(entity) ? parsePlayerFlags() : parseObjectFlags();
                const propCount = readUInt8();
                const properties = [];
                let hasPositionUpdate = false;

                for (let propertyIndex = 0; propertyIndex < propCount; propertyIndex++) {
                    const propertyId = readUInt16();
                    const value = parseUpdatedProperty(propertyId, entity);
                    properties.push({ propertyId, value });

                    if (propertyId === 0x01) {
                        hasPositionUpdate = true;
                    } else if (propertyId === 0x02) {
                        entity.rad = value.radius;
                    } else if (propertyId === 0x42) {
                        entity.curBiome = value.curBiome;
                    } else if (propertyId === 0x6c) {
                        entity.teamID = value.value;
                    }
                }

                if (isAnimal(entity) && entity.secondaryType === 0x3a) {
                    const trailingUpdateByte = readUInt8();
                    properties.push({ propertyId: 'customTrailingByte', value: trailingUpdateByte });
                    entity.extra = { ...(entity.extra || {}), isAttacking: trailingUpdateByte };
                }

                for (const property of properties) {
                    if (!property || !property.value || typeof property.value !== 'object' || Array.isArray(property.value)) {
                        continue;
                    }

                    Object.assign(entity, property.value);
                }

                if (hasPositionUpdate && Number.isFinite(entity.x) && Number.isFinite(entity.y)) {
                    const currentX = Number.isFinite(previousX) ? previousX : entity.x;
                    const currentY = Number.isFinite(previousY) ? previousY : entity.y;
                    const nextX = entity.x;
                    const nextY = entity.y;

                    entity.updateTime = nowMs;
                    entity.ox = currentX;
                    entity.oy = currentY;
                    entity.nx = nextX;
                    entity.ny = nextY;
                    entity.x = currentX;
                    entity.y = currentY;
                } else if (!Number.isFinite(entity.updateTime)) {
                    entity.updateTime = nowMs;
                }

                entity.flags = updateFlags;

                result.updatedEntities.push({
                    entityId,
                    entityType: entity.entityType,
                    secondaryType: entity.secondaryType,
                    flags: updateFlags,
                    properties,
                });
            };

            const parseRemovedEntity = () => {
                const entityId = readUInt32();
                const removed = { entityId, killerId: 0 };
                const hasKiller = readUInt8() > 0;
                if (hasKiller) {
                    removed.killerId = readUInt32();
                }
                return removed;
            };

            const parsePlayerSection = () => {
                const gameMode = state.gameMode;

                if (gameMode === 0x05) {
                    const dangerCircleX = readUInt32();
                    const dangerCircleY = readUInt32();
                    const dangerCircleRadius = readUInt32() * 5;
                    const nonZombiePlayersCount = readUInt16();
                    const zombieCount = readUInt16();
                    return {
                        dangerCircleX,
                        dangerCircleY,
                        dangerCircleRadius,
                        nonZombiePlayersCount,
                        zombieCount,
                        zombies: (() => {
                            const zombies = [];
                            for (let i = 0; i < zombieCount; i++) {
                                zombies.push({
                                    x: readUInt16() / 4,
                                    y: readUInt16() / 4,
                                    radius: readUInt16() / 10,
                                });
                            }
                            return zombies;
                        })(),
                    };
                }

                return null;
            };

            try {
                result.worldState = parseWorldState();

                if (includeAliveSections) {
                    result.optionalSections = parseAliveSections();
                }

                const newCount = readUInt16();
                for (let i = 0; i < newCount; i++) {
                    const entity = parseNewEntity();
                    result.newEntities.push(entity);
                    entityState[entity.entityId] = serializeForLog(entity, new WeakSet(), 0);
                }

                const updatedCount = readUInt16();
                for (let i = 0; i < updatedCount; i++) {
                    parseEntityUpdate();
                }

                const removedCount = readUInt16();
                for (let i = 0; i < removedCount; i++) {
                    const removed = parseRemovedEntity();
                    result.removedEntities.push(removed);
                    delete entityState[removed.entityId];
                }

                if (packetUtil.offset < totalBytes) {
                    result.playerSection = parsePlayerSection();
                }
            } catch (error) {
                result.parsingError = {
                    name: error.name,
                    message: error.message,
                    offset: packetUtil.offset,
                    remainingBytes: totalBytes - packetUtil.offset,
                    totalBytes,
                };
            }

            while (packetUtil.offset < totalBytes) {
                result.trailingBytes.push(view.getUint8(packetUtil.offset));
                packetUtil.offset += 1;
            }

            result.bytesParsed = packetUtil.offset;
            result.bytesRemaining = totalBytes - packetUtil.offset;
            result.entityState = entityState;
            return result;
        };

        const chooseBestAttempt = (attempts) => {
            const maxKnownObjectType = 0xa5;

            const scoreAttempt = (attempt) => {
                const invalidEntityTypes = attempt.newEntities.filter((entity) => entity.entityType < 0 || entity.entityType > maxKnownObjectType).length;
                const invalidEntityIds = [
                    ...attempt.newEntities.map((entity) => entity.entityId),
                    ...attempt.updatedEntities.map((entity) => entity.entityId),
                    ...attempt.removedEntities.map((entity) => entity.entityId),
                ].filter((entityId) => !Number.isInteger(entityId) || entityId <= 0).length;
                const duplicateRemovedEntityIds = (() => {
                    const seen = new Set();
                    let duplicates = 0;
                    for (const entry of attempt.removedEntities) {
                        if (seen.has(entry.entityId)) {
                            duplicates += 1;
                        } else {
                            seen.add(entry.entityId);
                        }
                    }
                    return duplicates;
                })();
                const unknownUpdatedEntityTypes = attempt.updatedEntities.filter((entity) => entity.entityType < 0 || entity.entityType > maxKnownObjectType).length;
                return [
                    invalidEntityTypes,
                    invalidEntityIds,
                    duplicateRemovedEntityIds,
                    unknownUpdatedEntityTypes,
                    attempt.parsingError ? 1 : 0,
                    attempt.trailingBytes.length,
                    attempt.parsingError ? attempt.parsingError.remainingBytes : 0,
                ];
            };

            return attempts.sort((left, right) => {
                const leftScore = scoreAttempt(left);
                const rightScore = scoreAttempt(right);
                for (let i = 0; i < leftScore.length; i++) {
                    if (leftScore[i] !== rightScore[i]) {
                        return leftScore[i] - rightScore[i];
                    }
                }
                return right.bytesParsed - left.bytesParsed;
            })[0];
        };

        let best;
        if (typeof state.isAliveInGame === 'boolean') {
            best = parseAttempt(state.isAliveInGame);
        } else {
            best = chooseBestAttempt([
                parseAttempt(true),
                parseAttempt(false),
            ]);
        }

        state.entities = best.entityState;
        if (
            Number.isInteger(state.previousPlayerId)
            && state.previousPlayerId > 0
            && state.previousPlayerId !== state.playerId
            && !state.entities[state.previousPlayerId]
        ) {
            state.previousPlayerId = null;
            state.previousPlayerIdUpdatedAt = null;
        }

        for (const entity of Object.values(best.entityState)) {
            enrichEntityRecord(entity);
        }
        for (const entity of best.newEntities) {
            enrichEntityRecord(entity);
        }
        for (const entity of best.updatedEntities) {
            enrichEntityRecord(entity);
        }
        if (best.playerSection) {
            enrichEntityRecord(best.playerSection);
        }

        this.worldState = best.worldState;
        this.optionalSections = best.optionalSections;
        this.newEntities = best.newEntities;
        this.updatedEntities = best.updatedEntities;
        this.removedEntities = best.removedEntities;
        this.removedEntityIds = best.removedEntities.map((entry) => entry.entityId);
        this.playerSection = best.playerSection;
        this.trailingBytes = best.trailingBytes;
        this.parserMode = best.parserMode;
        this.parseWarning = best.parsingError || null;
        this.finish(best.bytesParsed);
        this.totalBytes = totalBytes;
    }
}
