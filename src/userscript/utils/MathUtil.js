const MOPE_BASE_FRAME_MS = 8.333333333333334;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const FULL_CIRCLE_DEGREES = 360;

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.max(min, Math.min(max, value));
}

function lerpNumber(start, end, progress) {
    return start + (end - start) * progress;
}

function degreesToRadians(degrees) {
    return Number.isFinite(degrees) ? degrees * (Math.PI / 180) : 0;
}

function radiansToDegrees(radians) {
    return Number.isFinite(radians) ? radians * (180 / Math.PI) : 0;
}

function normalizeAngleRadians(radians) {
    if (!Number.isFinite(radians)) {
        return 0;
    }

    let normalized = radians % FULL_CIRCLE_RADIANS;
    if (normalized <= -Math.PI) {
        normalized += FULL_CIRCLE_RADIANS;
    } else if (normalized > Math.PI) {
        normalized -= FULL_CIRCLE_RADIANS;
    }

    return normalized;
}

function normalizeAngleDegrees(degrees) {
    if (!Number.isFinite(degrees)) {
        return 0;
    }

    let normalized = degrees % FULL_CIRCLE_DEGREES;
    if (normalized <= -180) {
        normalized += FULL_CIRCLE_DEGREES;
    } else if (normalized > 180) {
        normalized -= FULL_CIRCLE_DEGREES;
    }

    return normalized;
}

function calculateWrappedAngleDelta(fromRadians, toRadians) {
    if (!Number.isFinite(fromRadians) || !Number.isFinite(toRadians)) {
        return 0;
    }

    // Reference: assets/deobf.js _0x332590.
    let delta = toRadians - fromRadians;
    while (delta > Math.PI) {
        delta -= Math.PI * 2;
    }
    while (delta < -Math.PI) {
        delta += Math.PI * 2;
    }

    return delta;
}

function calculateWrappedAngleDeltaDegrees(fromDegrees, toDegrees) {
    if (!Number.isFinite(fromDegrees) || !Number.isFinite(toDegrees)) {
        return 0;
    }

    return normalizeAngleDegrees(toDegrees - fromDegrees);
}

function calculateAngleBetweenPoints(pointA, pointB) {
    if (!pointA || !pointB || typeof pointA !== 'object' || typeof pointB !== 'object') {
        return null;
    }

    const x1 = Number(pointA.x);
    const y1 = Number(pointA.y);
    const x2 = Number(pointB.x);
    const y2 = Number(pointB.y);
    if (![x1, y1, x2, y2].every(Number.isFinite)) {
        return null;
    }

    return Math.atan2(y2 - y1, x2 - x1);
}

function calculateAngleBetweenPointsDegrees(pointA, pointB) {
    const radians = calculateAngleBetweenPoints(pointA, pointB);
    return radians == null ? null : radiansToDegrees(radians);
}

function calculateDistanceBetweenPoints(pointA, pointB) {
    if (!pointA || !pointB || typeof pointA !== 'object' || typeof pointB !== 'object') {
        return null;
    }

    const x1 = Number(pointA.x);
    const y1 = Number(pointA.y);
    const x2 = Number(pointB.x);
    const y2 = Number(pointB.y);
    if (![x1, y1, x2, y2].every(Number.isFinite)) {
        return null;
    }

    // Reference: assets/deobf.js _0x50787b.
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateTurnLerpFactor(frameDeltaMs = MOPE_BASE_FRAME_MS) {
    const safeFrameDeltaMs = Number.isFinite(frameDeltaMs) ? frameDeltaMs : MOPE_BASE_FRAME_MS;

    // Reference: assets/deobf.js _0x5a8651.prototype.lerpAngle.
    return Math.min(0.1 * (safeFrameDeltaMs / MOPE_BASE_FRAME_MS), 1);
}

function calculateLerpedAngleStep(currentAngle, targetAngle, frameDeltaMs = MOPE_BASE_FRAME_MS) {
    const angleDelta = calculateWrappedAngleDelta(currentAngle, targetAngle);
    return angleDelta * calculateTurnLerpFactor(frameDeltaMs);
}

function calculateLerpedAngle(currentAngle, targetAngle, frameDeltaMs = MOPE_BASE_FRAME_MS) {
    if (!Number.isFinite(currentAngle) || !Number.isFinite(targetAngle)) {
        return currentAngle;
    }

    // Reference: assets/deobf.js _0x5a8651.prototype.lerpAngle.
    return currentAngle + calculateLerpedAngleStep(currentAngle, targetAngle, frameDeltaMs);
}

function calculateLerpedAngleDegrees(currentAngle, targetAngle, progress = 1) {
    if (!Number.isFinite(currentAngle) || !Number.isFinite(targetAngle)) {
        return currentAngle;
    }

    const safeProgress = clampNumber(Number(progress), 0, 1);
    return currentAngle + calculateWrappedAngleDeltaDegrees(currentAngle, targetAngle) * safeProgress;
}

function calculatePeriodicSineOffset(elapsedSeconds, periodSeconds, amplitude = 1, phaseRadians = 0) {
    if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(periodSeconds) || periodSeconds === 0) {
        return 0;
    }

    // Reference: assets/deobf.js repeated animation patterns such as drawUnderSkinTail and status pulses.
    return amplitude * Math.sin((2 * Math.PI / periodSeconds) * elapsedSeconds + phaseRadians);
}

function calculateAnimatedPulse(baseValue, amplitude, elapsedSeconds, periodSeconds, phaseRadians = 0) {
    return baseValue + calculatePeriodicSineOffset(elapsedSeconds, periodSeconds, amplitude, phaseRadians);
}

function calculateWingFlapFrame(elapsedSeconds, flapDurationSeconds = 2) {
    if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(flapDurationSeconds) || flapDurationSeconds <= 0) {
        return 0;
    }

    // Reference: assets/deobf.js _0x49cbd0.wave used by king dragon / AI boss wing animations.
    return Math.sin(Math.PI / flapDurationSeconds * elapsedSeconds);
}

function calculateWingFlapPose(radius, frameValue, options = {}) {
    const wingRadius = Number(radius);
    const frame = Number(frameValue);
    if (!Number.isFinite(wingRadius) || !Number.isFinite(frame)) {
        return null;
    }

    const outlineWidth = Number.isFinite(options.outlineWidth) ? options.outlineWidth : 0;
    const flapFactor = Number.isFinite(options.flapFactor) ? options.flapFactor : 0.1;
    const flapScaleFactor = Number.isFinite(options.flapScaleFactor) ? options.flapScaleFactor : 0.02;
    const flapAngleDegrees = Number.isFinite(options.flapAngleDegrees) ? options.flapAngleDegrees : 3;
    const flapAngleDiffDegrees = Number.isFinite(options.flapAngleDiffDegrees) ? options.flapAngleDiffDegrees : 3;
    const effectiveRadius = wingRadius - outlineWidth;
    const frameOffset = frame * flapScaleFactor * effectiveRadius;
    const flapAngleRadians = (-(-flapFactor + frame)) * (flapAngleDegrees * (Math.PI / 180));
    const flapAngleDiffRadians = flapAngleDiffDegrees * (Math.PI / 180);

    // Reference: assets/deobf.js king dragon / AI boss drawWings.
    return {
        radius: effectiveRadius,
        frameOffset,
        leftRotation: flapAngleDiffRadians + flapAngleRadians,
        rightRotation: -(flapAngleDiffRadians + flapAngleRadians),
    };
}

function calculateWaterRipplePulse(elapsedSeconds, isFloating = true) {
    if (!isFloating) {
        return 1;
    }

    // Reference: assets/deobf.js _0x39a9cb.prototype.waterRipples.
    return calculatePeriodicSineOffset(elapsedSeconds, 1.75, 0.5);
}

const MathUtil = Object.freeze({
    MOPE_BASE_FRAME_MS,
    degreesToRadians,
    radiansToDegrees,
    normalizeAngleRadians,
    normalizeAngleDegrees,
    clampNumber,
    lerpNumber,
    calculateWrappedAngleDelta,
    calculateWrappedAngleDeltaDegrees,
    calculateAngleBetweenPoints,
    calculateAngleBetweenPointsDegrees,
    calculateDistanceBetweenPoints,
    calculateTurnLerpFactor,
    calculateLerpedAngleStep,
    calculateLerpedAngle,
    calculateLerpedAngleDegrees,
    calculatePeriodicSineOffset,
    calculateAnimatedPulse,
    calculateWingFlapFrame,
    calculateWingFlapPose,
    calculateWaterRipplePulse,
});
