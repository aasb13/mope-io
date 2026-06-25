function getPacketLogQueue() {
    const root = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    if (!Array.isArray(root.__mopEnginePacketLogs)) {
        Object.defineProperty(root, '__mopEnginePacketLogs', {
            value: [],
            configurable: true,
            enumerable: false,
            writable: true,
        });
    }

    return root.__mopEnginePacketLogs;
}

function serializeForLog(value, seen, depth) {
    if (value === null || typeof value === 'undefined') {
        return value;
    }

    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (typeof value !== 'object') {
        return value;
    }

    if (depth >= 8) {
        return '[MaxDepth]';
    }

    if (seen.has(value)) {
        return '[Circular]';
    }

    if (Array.isArray(value)) {
        seen.add(value);
        const out = value.map((item) => serializeForLog(item, seen, depth + 1));
        seen.delete(value);
        return out;
    }

    if (value instanceof ArrayBuffer) {
        return { type: 'ArrayBuffer', byteLength: value.byteLength };
    }

    if (ArrayBuffer.isView(value)) {
        return {
            type: value.constructor && value.constructor.name ? value.constructor.name : 'TypedArray',
            byteLength: value.byteLength,
        };
    }

    seen.add(value);
    const out = {};
    for (const key of Object.keys(value)) {
        out[key] = serializeForLog(value[key], seen, depth + 1);
    }
    seen.delete(value);
    return out;
}

function emitPacketLog(record) {
    try {
        getPacketLogQueue().push(JSON.stringify(record));
    } catch (error) {
        console.warn('Packet log serialization failed:', error.message);
    }
}

function getPacketParserState() {
    const root = typeof unsafeWindow !== 'undefined' ? unsafeWindow : globalThis;

    if (!root.__mopePacketParserState || typeof root.__mopePacketParserState !== 'object') {
        Object.defineProperty(root, '__mopePacketParserState', {
            value: {},
            configurable: true,
            enumerable: false,
            writable: true,
        });
    }

    return root.__mopePacketParserState;
}

function updatePacketParserState(direction, header, parsedPacket) {
    if (direction !== 'RECV') {
        return;
    }

    const state = getPacketParserState();

    if (header === 0x02 && parsedPacket && typeof parsedPacket.isAliveInGame === 'boolean') {
        state.isAliveInGame = parsedPacket.isAliveInGame;
        if (typeof parsedPacket.gameMode === 'number') {
            state.gameMode = parsedPacket.gameMode;
        }
        return;
    }

    if (header === 0x12 && parsedPacket) {
        if (typeof parsedPacket.playerId === 'number') {
            if (typeof state.playerId === 'number' && state.playerId > 0 && state.playerId !== parsedPacket.playerId) {
                state.previousPlayerId = state.playerId;
                state.previousPlayerIdUpdatedAt = Date.now();
            } else if (state.previousPlayerId === parsedPacket.playerId) {
                state.previousPlayerId = null;
                state.previousPlayerIdUpdatedAt = null;
            }
            state.playerId = parsedPacket.playerId;
        }
        if (typeof parsedPacket.animalType === 'number') {
            state.currentAnimalType = parsedPacket.animalType;
        }
        if (typeof parsedPacket.animalSpecies === 'number') {
            state.currentAnimalSpecies = parsedPacket.animalSpecies;
        }
        state.currentAnimal = serializeForLog(enrichAnimalRecord({
            animalType: parsedPacket.animalType,
            animalSpecies: parsedPacket.animalSpecies,
            animalSubSpecies: parsedPacket.animalSubSpecies,
            changeState: parsedPacket.changeState,
            changeStateName: parsedPacket.changeStateName,
            score: parsedPacket.score,
            primaryAbilityType: parsedPacket.primaryAbilityType,
            secondaryAbilityType: parsedPacket.secondaryAbilityType,
        }), new WeakSet(), 0);

        if (Array.isArray(parsedPacket.animalTypeLists)) {
            const [dangerousAnimals, edibleAnimals, tailbiters, edibleObjects] = parsedPacket.animalTypeLists;

            state.currentAnimalTypeLists = parsedPacket.animalTypeLists.map((list) => ({
                listIndex: list.listIndex,
                listName: list.listName || null,
                count: list.count,
                animalTypes: list.animalTypes.map((entry) => ({ ...entry })),
            }));
            state.dangerousAnimalTypes = new Set((dangerousAnimals?.animalTypes || []).map((entry) => entry.animalType));
            state.edibleAnimalTypes = new Set((edibleAnimals?.animalTypes || []).map((entry) => entry.animalType));
            state.tailBiterAnimalTypes = new Set((tailbiters?.animalTypes || []).map((entry) => entry.animalType));
            state.edibleObjectTypes = new Set((edibleObjects?.animalTypes || []).map((entry) => entry.animalType));
        }
        return;
    }

    if (header === 0x04 && parsedPacket) {
        if (Array.isArray(parsedPacket.worldState)) {
            state.lastWorldState = parsedPacket.worldState.map((entry) => ({ ...entry }));

            const nowMs = Date.now();
            for (let index = 0; index < parsedPacket.worldState.length; index += 1) {
                const entry = parsedPacket.worldState[index];
                if (!entry || typeof entry !== 'object') {
                    continue;
                }

                if (entry.type === 0x01 && Number.isFinite(entry.value)) {
                    state.previousCameraZoom = Number.isFinite(state.cameraZoom)
                        ? state.cameraZoom
                        : entry.value;
                    state.cameraZoom = entry.value;
                    state.cameraUpdateTime = nowMs;
                }

                if (entry.type === 0x03 && Number.isFinite(entry.x) && Number.isFinite(entry.y)) {
                    state.previousCameraX = Number.isFinite(state.cameraX) ? state.cameraX : entry.x;
                    state.previousCameraY = Number.isFinite(state.cameraY) ? state.cameraY : entry.y;
                    state.cameraX = entry.x;
                    state.cameraY = entry.y;
                    state.cameraUpdateTime = nowMs;
                }
            }
        }
        if (parsedPacket.optionalSections && typeof parsedPacket.optionalSections === 'object') {
            state.lastOptionalSections = serializeForLog(parsedPacket.optionalSections, new WeakSet(), 0);
        }
        if (parsedPacket.playerSection && typeof parsedPacket.playerSection === 'object') {
            state.lastPlayerSection = serializeForLog(parsedPacket.playerSection, new WeakSet(), 0);
        }
        return;
    }

    if (header === 0x06) {
        state.isAliveInGame = true;
        return;
    }

    if (header === 0x0b || header === 0x0e) {
        state.isAliveInGame = false;
        state.previousPlayerId = null;
        state.previousPlayerIdUpdatedAt = null;
    }
}

function getPacketLabel(direction, header, Target, parsedPacket) {
    const baseLabel = typeof Target === 'function' ? Target.name : (Target || 'UNKNOWN');

    if (direction === 'RECV' && (header === 0x51 || header === 0x6f) && parsedPacket && typeof parsedPacket.subType === 'number') {
        const suffix = parsedPacket.subTypeName || `SubType${parsedPacket.subType}`;
        return `${baseLabel}.${suffix}`;
    }

    return baseLabel;
}

function getPacketParserStateSnapshot() {
    return serializePacketParserStateSnapshot(getPacketParserState());
}

function processPacket(direction, data) {
    const { header, Target, parsedPacket, parsingError } = parsePacket(direction, data);
    const color = direction === 'SENT' ? '#ffaa00' : '#00ff00';
    const hexdump = getHexdump(data);
    const label = getPacketLabel(direction, header, Target, parsedPacket);
    updatePacketParserState(direction, header, parsedPacket);

    emitPacketLog({
        timestamp: new Date().toISOString(),
        direction,
        header,
        label,
        length: data.byteLength,
        parsed: serializeForLog(parsedPacket, new WeakSet(), 0),
        parsingError,
        hexdump,
    });

    const parsedPacketText = parsedPacket
        ? JSON.stringify(serializeForLog(parsedPacket, new WeakSet(), 0), null, 2)
        : null;

}
