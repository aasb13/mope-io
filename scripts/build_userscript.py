#!/usr/bin/env python3
from __future__ import annotations

import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "userscript"
OUTPUT = ROOT / "userscript.js"
DEOBF = ROOT / "assets" / "deobf.js"

BUILD_SECTIONS = {
    "utils": [
        "utils/World.js",
        "utils/TextUtil.js",
        "utils/MathUtil.js",
        "utils/Vector2d.js",
        "utils/Vector3d.js",
        "utils/Color.js",
        "utils/PlayerUtil.js",
        "utils/FontUtil.js",
        "utils/RenderUtil.js",
        "utils/EntityUtil.js",
        "utils/SearchUtil.js",
        "utils/InjectUtil.js",
        "utils/LogUtil.js",
        "utils/PacketUtil.js",
        "utils/Packet.js",
    ],
    "events": [
        "event/Priority.js",
        "event/Event.js",
        "event/EventManager.js",
        "event/impl/PacketEvent.js",
        "event/impl/SendPacketEvent.js",
        "event/impl/ReceivePacketEvent.js",
        "event/impl/ModuleEvent.js",
        "event/impl/ModuleEnableEvent.js",
        "event/impl/ModuleDisableEvent.js",
    ],
    "structures": [
        "structures/AnimalType.js",
        "structures/Biome.js",
        "structures/AbilityType.js",
        "structures/ObjectVariantType.js",
        "structures/ObjectType.js",
        "utils/GameMetadata.js",
    ],
    "modules": [
        "module/Category.js",
        "module/setting/Setting.js",
        "module/setting/BooleanSetting.js",
        "module/setting/StringSetting.js",
        "module/setting/NumberSetting.js",
        "module/setting/SliderSetting.js",
        "module/setting/SelectorSetting.js",
        "module/Module.js",
        "ui/UI.js",
        "ui/ClickGUI.js",
        "module/impl/AutoAttackModule.js",
        "module/impl/XrayModule.js",
        "module/impl/AutoRespawnModule.js",
        "module/impl/TracersModule.js",
        "module/impl/PacketLoggerModule.js",
        "module/impl/ClickGUIModule.js",
        "module/ModuleManager.js",
    ],
    "network": [
        "network/1_CHandshakePacket.js",
        "network/2_SServerInfoPacket.js",
        "network/3_SOnConnectPacket.js",
        "network/4_SEntityUpdatePacket.js",
        "network/5_CMovementPacket.js",
        "network/6_SPlayerAliveInGamePacket.js",
        "network/8_SLeaderboardPacket.js",
        "network/10_SServerMetricsPacket.js",
        "network/11_CCleanDisconnectPacket.js",
        "network/11_SDisconnectPacket.js",
        "network/14_SDeathPacket.js",
        "network/16_SSimpleMessagePacket.js",
        "network/17_CResizePacket.js",
        "network/17_SCameraStatePacket.js",
        "network/18_SYourAnimalChangedPacket.js",
        "network/19_CClientChatPacket.js",
        "network/19_SServerChatPacket.js",
        "network/20_CWAbilityStatePacket.js",
        "network/21_CBoostStatePacket.js",
        "network/23_SStatusEffectPacket.js",
        "network/24_CUpgradeSelectionPacket.js",
        "network/25_SCountdownTimerPacket.js",
        "network/26_CKeyInputPacket.js",
        "network/27_CSecondaryKeyInputPacket.js",
        "network/28_CSAbilityStatePacket.js",
        "network/29_CAlternateKeyInputPacket.js",
        "network/30_CExtraKeyInputPacket.js",
        "network/52_CArenaInviteRequestPacket.js",
        "network/68_CArenaTargetPacket.js",
        "network/69_SPlayerInfoPacket.js",
        "network/56_SSpectateModePacket.js",
        "network/58_SDisplayMessagePacket.js",
        "network/59_SCustomInterfacePacket.js",
        "network/60_CControlInputPacket.js",
        "network/61_CInterfaceButtonPacket.js",
        "network/62_CAdblockCheckResponsePacket.js",
        "network/62_SAdblockCheckPacket.js",
        "network/63_CExpressionResultPacket.js",
        "network/63_SExpressionChallengePacket.js",
        "network/64_CTurnstileTokenPacket.js",
        "network/64_STurnstileChallengePacket.js",
        "network/66_CIJKLKeyStatePacket.js",
        "network/65_SReadyToPlayPacket.js",
        "network/71_CLoginCredentialsPacket.js",
        "network/67_SAnnouncementPacket.js",
        "network/72_SMiniMapPacket.js",
        "network/81_SGameRoomPacket.js",
        "network/100_SSnowfallStatePacket.js",
        "network/102_SLoadUserDataPacket.js",
        "network/104_SMultiLinkPacket.js",
        "network/105_SExtraAnimalDataPacket.js",
        "network/106_SPopupMessagePacket.js",
        "network/24_SUpgradeMenuPacket.js",
        "network/107_SPromptPacket.js",
        "network/108_SPlayersOnMiniMapPacket.js",
        "network/109_SMiniMapMarkerPacket.js",
        "network/112_SGameRoomPropertyUpdatePacket.js",
        "network/111_SSocketMessagesPacket.js",
        "network/113_CArenaPositionPacket.js",
        "network/113_SDisconnectOnExceedingRateLimitPacket.js",
        "network/114_SPumpkinsOnMiniMapPacket.js",
        "network/255_CKeepAlivePacket.js",
        "network/255_SKeepAlivePacket.js",
    ],
    "core": [
        "core/PacketRegistry.js",
        "core/PacketEvents.js",
        "core/PacketLogger.js",
        "core/WebSocketProxy.js",
        "main.js",
    ],
}


ANIMAL_INFO_ANCHOR = "_0x169d40.prototype.animalInfo = function () {"

def build_order() -> list[Path]:
    ordered_paths: list[Path] = []
    for section, relative_paths in BUILD_SECTIONS.items():
        if not relative_paths:
            raise ValueError(f"Build section {section!r} is empty")
        ordered_paths.extend(SRC / relative_path for relative_path in relative_paths)
    return ordered_paths

def validate_build_order(paths: list[Path]) -> None:
    seen: set[Path] = set()
    duplicates: list[str] = []
    missing: list[str] = []

    for path in paths:
        relative = path.relative_to(SRC).as_posix()
        if path in seen:
            duplicates.append(relative)
            continue
        seen.add(path)
        if not path.exists():
            missing.append(relative)

    discovered = {path.resolve() for path in SRC.rglob("*.js") if path.name != "metadata.js"}
    ordered = {path.resolve() for path in paths}
    unlisted = sorted(path.relative_to(SRC).as_posix() for path in discovered - ordered)

    problems: list[str] = []
    if duplicates:
        problems.append(f"duplicate entries: {', '.join(sorted(duplicates))}")
    if missing:
        problems.append(f"missing files: {', '.join(sorted(missing))}")
    if unlisted:
        problems.append(f"unlisted source files: {', '.join(unlisted)}")

    if problems:
        raise ValueError("Invalid userscript build manifest: " + "; ".join(problems))


def find_matching_brace(source: str, open_brace_index: int) -> int:
    depth = 0
    in_string = False
    string_quote = ""
    escaped = False

    for index in range(open_brace_index, len(source)):
        char = source[index]

        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                in_string = False
            continue

        if char in {"'", '"'}:
            in_string = True
            string_quote = char
            continue

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index

    raise ValueError("Unmatched brace while parsing deobf.js")


def decode_js_string(literal: str) -> str:
    return ast.literal_eval(literal)


def simplify_js_string_expression(expression: str) -> str | None:
    expr = expression.strip()
    expr = re.sub(r"\b_[A-Za-z0-9$]+\.(aniName|aniDesc)\b", r"{\1}", expr)
    expr = re.sub(r"\bthis\.(aniName|aniDesc)\b", r"{\1}", expr)
    expr = re.sub(r"\s+", " ", expr)

    pieces: list[str] = []
    position = 0
    token_pattern = re.compile(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|\{(?:aniName|aniDesc)\}')

    for match in token_pattern.finditer(expr):
        between = expr[position:match.start()]
        if between.strip().strip("+"):
            return None
        token = match.group(0)
        if token.startswith(("{",)):
            pieces.append(token)
        else:
            pieces.append(decode_js_string(token))
        position = match.end()

    if expr[position:].strip().strip("+"):
        return None

    return "".join(piece for piece in pieces if piece != "")


def extract_assignment(block: str, field_name: str) -> str | None:
    match = re.search(rf"\.{field_name}\s*=\s*(.*?);", block, re.DOTALL)
    if not match:
        return None
    return simplify_js_string_expression(match.group(1))


def build_generated_animal_metadata() -> str:
    source = DEOBF.read_text(encoding="utf-8")
    anchor_index = source.find(ANIMAL_INFO_ANCHOR)
    if anchor_index == -1:
        raise ValueError(f"Could not find {ANIMAL_INFO_ANCHOR!r} in {DEOBF}")

    open_brace_index = source.find("{", anchor_index)
    close_brace_index = find_matching_brace(source, open_brace_index)
    function_body = source[open_brace_index + 1:close_brace_index]

    switch_index = function_body.find("switch (this.animalType)")
    if switch_index == -1:
        raise ValueError("Could not find animalInfo switch body in deobf.js")

    switch_open = function_body.find("{", switch_index)
    switch_close = find_matching_brace(function_body, switch_open)
    switch_body = function_body[switch_open + 1:switch_close]

    case_pattern = re.compile(
        r"case\s+(0x[0-9a-fA-F]+|\d+)\s*:(.*?)(?=case\s+(?:0x[0-9a-fA-F]+|\d+)\s*:|default\s*:|\Z)",
        re.DOTALL,
    )

    metadata: dict[int, dict[str, str]] = {}
    for match in case_pattern.finditer(switch_body):
        animal_type = int(match.group(1), 0)
        block = match.group(2)
        info: dict[str, str] = {}

        for source_field, output_field in (
            ("aniName", "name"),
            ("aniDesc", "description"),
            ("upgradeText", "upgradeText"),
            ("aniCol", "color"),
            ("skinName", "skinName"),
        ):
            value = extract_assignment(block, source_field)
            if value:
                info[output_field] = value

        if info:
            metadata[animal_type] = info

    generated = json.dumps(metadata, ensure_ascii=True, indent=4, sort_keys=True)
    return f"const GeneratedAnimalMetadata = Object.freeze({generated});"


def build_userscript() -> Path:
    ordered_paths = build_order()
    validate_build_order(ordered_paths)
    metadata = (SRC / "metadata.js").read_text(encoding="utf-8").strip()
    body_parts = [f"// --- generated/AnimalMetadata.js ---\n{build_generated_animal_metadata()}"]

    for path in ordered_paths:
        content = path.read_text(encoding="utf-8").strip()
        body_parts.append(f"// --- {path.relative_to(SRC)} ---\n{content}")

    output = metadata + "\n\n" + "\n\n".join(body_parts) + "\n"
    OUTPUT.write_text(output, encoding="utf-8")
    return OUTPUT


if __name__ == "__main__":
    output_path = build_userscript()
    print(f"Built {output_path}")
