const TAIL_HITBOX_EXCLUDED_ANIMAL_TYPES = new Set([0x01, 0x02, 0x11]);
const ENTITY_LERP_WINDOW_MS = 175;
const PACKET_ENTITY_STALE_MS = 2500;
const MAX_REASONABLE_WORLD_COORDINATE = 20000;
const MAX_REASONABLE_ENTITY_RADIUS = 5000;
const ENTITY_TYPE_PLAYER = 0x02;
const ENTITY_TYPE_FIRE_OBJECT = 0x0e;

function getEntityUtilState() {
    const root = typeof unsafeWindow !== 'undefined'
        ? unsafeWindow
        : (typeof globalThis !== 'undefined' ? globalThis : window);
    const state = root.__mopePacketParserState;
    return state && typeof state === 'object' ? state : {};
}

function getEntityRadius(entity) {
    if (!entity || typeof entity !== 'object') {
        return null;
    }

    const radius = typeof entity.rad === 'number' ? entity.rad : entity.radius;
    return typeof radius === 'number' && Number.isFinite(radius) ? radius : null;
}

function getEntityAngleOffsetDegrees(entity) {
    const entityType = entity?.entityType ?? entity?.oType;
    if (entityType === ENTITY_TYPE_PLAYER) {
        return -0x5a;
    }

    return entityType === ENTITY_TYPE_FIRE_OBJECT ? 0xb4 : 0x5a;
}

function convertEntityAngleDegreesToRadians(entity, angleDegrees) {
    if (!Number.isFinite(angleDegrees)) {
        return null;
    }

    return (angleDegrees + getEntityAngleOffsetDegrees(entity)) * (Math.PI / 0xb4);
}

function getEntityAngleRadians(entity) {
    if (!entity || typeof entity !== 'object') {
        return null;
    }

    // Reference: assets/deobf.js _0x169d40.prototype.updateAngle.
    if (typeof entity.angleRadians === 'number' && Number.isFinite(entity.angleRadians)) {
        return entity.angleRadians;
    }

    if (typeof entity.angleDegrees === 'number' && Number.isFinite(entity.angleDegrees)) {
        return convertEntityAngleDegreesToRadians(entity, entity.angleDegrees);
    }

    if (typeof entity.angleByte === 'number' && Number.isFinite(entity.angleByte)) {
        return convertEntityAngleDegreesToRadians(entity, entity.angleByte * 2);
    }

    if (typeof entity.angle === 'number' && Number.isFinite(entity.angle)) {
        return entity.angle;
    }

    return null;
}

function getEntityTargetAngleRadians(entity) {
    if (!entity || typeof entity !== 'object') {
        return null;
    }

    if (typeof entity.nAngle === 'number' && Number.isFinite(entity.nAngle)) {
        return entity.nAngle;
    }

    return getEntityAngleRadians(entity);
}

function canEntityUseTailHitbox(entity) {
    if (!entity || typeof entity !== 'object') {
        return false;
    }

    const animalType = entity.animalType ?? entity.secondaryType;
    if (TAIL_HITBOX_EXCLUDED_ANIMAL_TYPES.has(animalType)) {
        return false;
    }

    if (entity.killerId > 0 || entity.flag_underWater || entity.flags?.flag_underWater) {
        return false;
    }

    return getEntityRadius(entity) != null && getEntityAngleRadians(entity) != null;
}

function getTailSwingDegrees(entity, nowMs = Date.now()) {
    const spawnTime = typeof entity?.spawnTime === 'number' ? entity.spawnTime : 0;
    const elapsedSeconds = (nowMs - spawnTime) / 1000;

    // Reference: assets/deobf.js _0x169d40.prototype.drawUnderSkinTail.
    return calculatePeriodicSineOffset(elapsedSeconds, 5, 4);
}

function getTailHitboxGeometry(entity, nowMs = Date.now()) {
    if (!canEntityUseTailHitbox(entity)) {
        return null;
    }

    const radius = getEntityRadius(entity);
    const angle = getEntityAngleRadians(entity);
    const x = typeof entity.x === 'number' ? entity.x : 0;
    const y = typeof entity.y === 'number' ? entity.y : 0;
    const outlineW = typeof entity.outlineW === 'number' ? entity.outlineW : 2;
    const tailSwingDegrees = getTailSwingDegrees(entity, nowMs);
    const degreesToRadians = Math.PI / 0xb4;
    const tailLength = radius * 0.1;
    const baseRadius = radius - outlineW;
    const tipRadius = radius + tailLength;
    const baseLeftRelativeRadians = 282.5 * degreesToRadians;
    const baseRightRelativeRadians = 257.5 * degreesToRadians;
    const tipRelativeRadians = (0x10e + tailSwingDegrees) * degreesToRadians;
    const baseLeftAngle = angle + baseLeftRelativeRadians;
    const baseRightAngle = angle + baseRightRelativeRadians;
    const tipAngle = angle + tipRelativeRadians;

    const baseLeft = {
        x: x + baseRadius * Math.cos(baseLeftAngle),
        y: y + baseRadius * Math.sin(baseLeftAngle),
    };
    const baseRight = {
        x: x + baseRadius * Math.cos(baseRightAngle),
        y: y + baseRadius * Math.sin(baseRightAngle),
    };
    const tip = {
        x: x + tipRadius * Math.cos(tipAngle),
        y: y + tipRadius * Math.sin(tipAngle),
    };

    return {
        center: { x, y },
        baseLeft,
        baseRight,
        tip,
        baseRadius,
        tipRadius,
        tailLength,
        tailSwingDegrees,
        angle,
        tipAngle,
    };
}

function calculateTailHitboxPosition(entity, nowMs = Date.now()) {
    const geometry = getTailHitboxGeometry(entity, nowMs);
    if (!geometry) {
        return null;
    }

    return {
        x: geometry.tip.x,
        y: geometry.tip.y,
        localX: geometry.tipRadius * Math.cos(geometry.tipAngle - geometry.angle),
        localY: geometry.tipRadius * Math.sin(geometry.tipAngle - geometry.angle),
        baseRadius: geometry.baseRadius,
        tailLength: geometry.tailLength,
        angle: geometry.tipAngle,
    };
}

function calculateEntityIdealOpacity(entity, options = {}) {
    if (!entity || typeof entity !== 'object') {
        return 1;
    }

    const animalType = entity.animalType ?? entity.secondaryType;
    const flags = entity.flags || {};
    const isUsingDiveAbility = entity.flag_usingDiveAbility ?? flags.flag_usingDiveAbility ?? false;
    const isUnderWater = entity.flag_underWater ?? flags.flag_underWater ?? false;
    const isUsingAbility = entity.flag_usingAbility ?? flags.flag_usingAbility ?? false;
    const isFlying = entity.flag_flying ?? flags.flag_flying ?? false;
    const isInArena = entity.flag_isInArena ?? flags.flag_isInArena ?? false;
    const isStealthed = entity.flag_stealth ?? flags.flag_stealth ?? false;
    const isInHidingHole = entity.flag_inHidingHole ?? flags.flag_inHidingHole ?? false;
    const grabbedBySelf = entity.gabbedByAniID === entity.id || entity.grabbedAniID === entity.id;
    const isLocalPlayer = options.isLocalPlayer ?? false;
    const isInside1v1Arena = options.isInside1v1Arena ?? false;

    // Reference: assets/deobf.js _0x169d40.prototype.getIdealOpacity / setStealth / setOpacityForFlyingAnimals.
    let idealOpacity = (
        isUsingDiveAbility
        || isUnderWater
        || (isUsingAbility && (animalType === 0x06 || animalType === 0x1d || animalType === 0x20))
    ) ? 0 : 1;

    if (isInside1v1Arena || isInArena) {
        idealOpacity = 0.6;
    } else if (isStealthed || isInHidingHole) {
        idealOpacity = 0.2;
    }

    if (isFlying && !grabbedBySelf && !isLocalPlayer) {
        idealOpacity = 0.6;
    }

    return idealOpacity;
}

function calculateEntityInterpolatedAngle(entity, options = {}) {
    if (!entity || typeof entity !== 'object') {
        return null;
    }

    const currentAngle = getEntityAngleRadians(entity);
    if (!Number.isFinite(currentAngle)) {
        return null;
    }

    const targetAngle = getEntityTargetAngleRadians(entity);
    if (!Number.isFinite(targetAngle)) {
        return currentAngle;
    }

    const easeAngleChanges = entity.easeAngleChanges ?? true;
    if (!easeAngleChanges) {
        return targetAngle;
    }

    const frameDeltaMs = Number.isFinite(options.frameDeltaMs) ? options.frameDeltaMs : undefined;

    // Reference: assets/deobf.js _0x5a8651.prototype.lerpAngle.
    return calculateLerpedAngle(currentAngle, targetAngle, frameDeltaMs);
}

function calculateEntityTurnDelta(entity, options = {}) {
    if (!entity || typeof entity !== 'object') {
        return null;
    }

    const currentAngle = getEntityAngleRadians(entity);
    const targetAngle = getEntityTargetAngleRadians(entity);
    if (!Number.isFinite(currentAngle) || !Number.isFinite(targetAngle)) {
        return null;
    }

    const frameDeltaMs = Number.isFinite(options.frameDeltaMs) ? options.frameDeltaMs : undefined;
    const angleDelta = calculateWrappedAngleDelta(currentAngle, targetAngle);
    const step = calculateLerpedAngleStep(currentAngle, targetAngle, frameDeltaMs);

    return {
        currentAngle,
        targetAngle,
        angleDelta,
        step,
        nextAngle: currentAngle + step,
    };
}

function calculateEntityLerpProgress(entity, nowMs = Date.now(), lerpWindowMs = ENTITY_LERP_WINDOW_MS) {
    if (!entity || typeof entity !== 'object' || typeof entity.updateTime !== 'number') {
        return 1;
    }

    // Reference: assets/deobf.js _0x5a8651.prototype.moveUpdate.
    const rawProgress = (nowMs - entity.updateTime) / lerpWindowMs;
    return clampNumber(rawProgress, 0, 1);
}

function calculateEntityInterpolatedPosition(entity, nowMs = Date.now(), lerpWindowMs = ENTITY_LERP_WINDOW_MS) {
    if (!entity || typeof entity !== 'object') {
        return null;
    }

    const progress = calculateEntityLerpProgress(entity, nowMs, lerpWindowMs);
    const ox = typeof entity.ox === 'number' ? entity.ox : entity.x;
    const oy = typeof entity.oy === 'number' ? entity.oy : entity.y;
    const nx = typeof entity.nx === 'number' ? entity.nx : entity.x;
    const ny = typeof entity.ny === 'number' ? entity.ny : entity.y;

    if (![ox, oy, nx, ny].every((value) => typeof value === 'number' && Number.isFinite(value))) {
        return null;
    }

    return {
        progress,
        x: lerpNumber(ox, nx, progress),
        y: lerpNumber(oy, ny, progress),
    };
}

function getEntityPosition(entity, nowMs = Date.now()) {
    const interpolated = calculateEntityInterpolatedPosition(entity, nowMs);
    if (interpolated) {
        return interpolated;
    }

    if (entity && Number.isFinite(entity.x) && Number.isFinite(entity.y)) {
        return {
            x: entity.x,
            y: entity.y,
        };
    }

    return null;
}

function isRenderableWorldObject(object) {
    return Boolean(
        object
        && typeof object === 'object'
        && Number.isInteger(Number(object.id))
        && Number(object.id) > 0
        && Number.isFinite(object.x)
        && Number.isFinite(object.y)
        && object.drawMe !== false
        && object.dead !== true
    );
}

function hasSanePacketEntityBounds(entity) {
    if (!entity || typeof entity !== 'object') {
        return false;
    }

    const x = Number(entity.x);
    const y = Number(entity.y);
    if (
        !Number.isFinite(x)
        || !Number.isFinite(y)
        || Math.abs(x) > MAX_REASONABLE_WORLD_COORDINATE
        || Math.abs(y) > MAX_REASONABLE_WORLD_COORDINATE
    ) {
        return false;
    }

    const radius = Number(entity.rad ?? entity.radius);
    if (Number.isFinite(radius) && (radius <= 0 || radius > MAX_REASONABLE_ENTITY_RADIUS)) {
        return false;
    }

    return true;
}

function isPacketEntityRenderable(entity, options = {}) {
    const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    const staleAfterMs = Number.isFinite(options.staleAfterMs) ? options.staleAfterMs : PACKET_ENTITY_STALE_MS;
    const entityId = Number(entity?.entityId ?? entity?.id);
    const updateTime = Number(entity?.updateTime);
    return Boolean(
        entity
        && typeof entity === 'object'
        && Number.isInteger(entityId)
        && entityId > 0
        && hasSanePacketEntityBounds(entity)
        && entity.dead !== true
        && entity.drawMe !== false
        && (!Number.isFinite(entity.killerId) || entity.killerId <= 0)
        && (!Number.isFinite(updateTime) || (nowMs - updateTime) <= staleAfterMs)
    );
}

function getRenderableEntityPosition(entity, nowMs = Date.now(), options = {}) {
    if (!entity || typeof entity !== 'object') {
        return null;
    }

    const requireLiveWorldObject = options.requireLiveWorldObject === true;
    const liveFallbackAllowed = options.liveFallbackAllowed !== false;
    const liveObjectResolver = typeof options.liveObjectResolver === 'function'
        ? options.liveObjectResolver
        : null;
    const liveObject = liveObjectResolver ? liveObjectResolver(entity) : null;
    if (isRenderableWorldObject(liveObject)) {
        return getEntityPosition(liveObject, nowMs);
    }

    if (requireLiveWorldObject || !liveFallbackAllowed || !isPacketEntityRenderable(entity)) {
        return null;
    }

    return getEntityPosition(entity, nowMs);
}

function scanCoinTargets(entities) {
    if (!entities || typeof entities !== 'object') {
        return [];
    }

    const nowMs = Date.now();
    return Object.values(entities).filter((entity) => (
        entity
        && entity.entityType === 0x84
        && isPacketEntityRenderable(entity, { nowMs })
    ));
}

function scanHealingStoneTargets(entities) {
    if (!entities || typeof entities !== 'object') {
        return [];
    }

    const nowMs = Date.now();
    return Object.values(entities).filter((entity) => (
        entity
        && entity.entityType === 0x2e
        && isPacketEntityRenderable(entity, { nowMs })
    ));
}

function normalizeExcludedEntityIds(playerIds) {
    if (playerIds instanceof Set) {
        return playerIds;
    }

    const excludedIds = new Set();
    const candidateIds = Array.isArray(playerIds) ? playerIds : [playerIds];
    for (let index = 0; index < candidateIds.length; index += 1) {
        const entityId = Number(candidateIds[index]);
        if (Number.isInteger(entityId) && entityId > 0) {
            excludedIds.add(entityId);
        }
    }

    return excludedIds;
}

function scanPlayerTargets(entities, playerIds) {
    if (!entities || typeof entities !== 'object') {
        return [];
    }

    const nowMs = Date.now();
    const excludedIds = normalizeExcludedEntityIds(playerIds);
    return Object.values(entities).filter((entity) => (
        entity
        && entity.entityType === 0x02
        && !excludedIds.has(entity.entityId)
        && typeof entity.secondaryType === 'number'
        && entity.secondaryType > 0
        && isPacketEntityRenderable(entity, { nowMs })
    ));
}

function scanCoinTargetsFromWorld(objects) {
    if (!Array.isArray(objects)) {
        return [];
    }

    return objects.filter((object) => (
        object
        && object.oType === 0x84
        && object.drawMe !== false
        && object.dead !== true
    )).map((object) => ({
        entityId: object.id,
        entityType: object.oType,
    }));
}

function scanHealingStoneTargetsFromWorld(objects) {
    if (!Array.isArray(objects)) {
        return [];
    }

    return objects.filter((object) => (
        object
        && object.oType === 0x2e
        && object.drawMe !== false
        && object.dead !== true
    )).map((object) => ({
        entityId: object.id,
        entityType: object.oType,
    }));
}

function scanPlayerTargetsFromWorld(objects, playerIds) {
    if (!Array.isArray(objects)) {
        return [];
    }

    const excludedIds = normalizeExcludedEntityIds(playerIds);
    return objects.filter((object) => (
        object
        && object.oType === 0x02
        && !excludedIds.has(object.id)
        && object.drawMe !== false
        && object.dead !== true
    )).map((object) => ({
        entityId: object.id,
        entityType: object.oType,
        secondaryType: object.animalType,
    }));
}

function getLocalPlayerScreenRadius(options = {}) {
    const {
        nowMs = Date.now(),
        camera = null,
        resolveLiveWorldObject = null,
    } = options;

    const localPlayer = getCurrentPlayerEntity();
    const liveLocalObject = localPlayer && typeof resolveLiveWorldObject === 'function'
        ? resolveLiveWorldObject(localPlayer.entityId, nowMs)
        : null;
    const localRadius = getEntityRadius(liveLocalObject) ?? getEntityRadius(localPlayer);
    if (!Number.isFinite(localRadius) || !camera || !Number.isFinite(camera.zoom)) {
        return 0;
    }

    return Math.max(0, localRadius * camera.zoom);
}

function isFoodEdibleForCurrentPlayer(foodEntity, options = {}) {
    if (!foodEntity || typeof foodEntity !== 'object') {
        return false;
    }

    const state = options.state && typeof options.state === 'object' ? options.state : getEntityUtilState();
    const objectType = foodEntity.entityType ?? foodEntity.oType ?? foodEntity.type;
    if (typeof objectType !== 'number' || !Number.isFinite(objectType) || objectType <= 0) {
        return false;
    }

    const localPlayerId = options.currentPlayerId ?? state.playerId ?? null;
    const edibleObjectTypes = options.edibleObjectTypes ?? state.edibleObjectTypes ?? null;

    // Reference: assets/deobf.js _0x5a8651.prototype.isEdibleOutlined and overrides for
    // ostrich/turkey egg style entities that suppress self-spawned food.
    if (localPlayerId != null) {
        if (foodEntity.mommyID === localPlayerId || foodEntity.playerID === localPlayerId || foodEntity.spawnedByID === localPlayerId) {
            return false;
        }
    }

    if (edibleObjectTypes instanceof Set) {
        return edibleObjectTypes.has(objectType);
    }

    if (Array.isArray(edibleObjectTypes)) {
        return edibleObjectTypes.includes(objectType);
    }

    if (edibleObjectTypes && typeof edibleObjectTypes === 'object') {
        return Boolean(edibleObjectTypes[objectType] || edibleObjectTypes[objectType - 1]);
    }

    return false;
}
