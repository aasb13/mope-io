const Registry = {
    SENT: {
        1: HandshakePacket,
        5: MovementPacket,
        11: CleanDisconnectPacket,
        17: ResizePacket,
        19: ClientChatPacket,
        20: WAbilityStatePacket,
        21: BoostStatePacket,
        24: UpgradeSelectionPacket,
        26: KeyInputPacket,
        27: SecondaryKeyInputPacket,
        28: SAbilityStatePacket,
        29: AlternateKeyInputPacket,
        30: ExtraKeyInputPacket,
        60: ControlInputPacket,
        61: InterfaceButtonPacket,
        62: AdblockCheckResponsePacket,
        63: ExpressionResultPacket,
        64: TurnstileTokenPacket,
        66: IJKLKeyStatePacket,
        71: LoginCredentialsPacket,
        113: ArenaPositionPacket,
        255: KeepAlivePacket,
    },
    RECV: {
        2: ServerInfoPacket,
        3: OnConnectPacket,
        4: EntityUpdatePacket,
        6: PlayerAliveInGamePacket,
        8: LeaderboardPacket,
        10: ServerMetricsPacket,
        11: DisconnectPacket,
        14: DeathPacket,
        16: SimpleMessagePacket,
        17: CameraStatePacket,
        18: YourAnimalChangedPacket,
        19: ServerChatPacket,
        23: StatusEffectPacket,
        24: UpgradeMenuPacket,
        25: CountdownTimerPacket,
        56: SpectateModePacket,
        58: DisplayMessagePacket,
        59: CustomInterfacePacket,
        62: AdblockCheckPacket,
        63: ExpressionChallengePacket,
        64: TurnstileChallengePacket,
        65: ReadyToPlayPacket,
        67: AnnouncementPacket,
        69: PlayerInfoPacket,
        72: MiniMapPacket,
        81: GameRoomPacket,
        100: SnowfallStatePacket,
        102: LoadUserDataPacket,
        103: PromptPacket,
        104: MultiLinkPacket,
        105: ExtraAnimalDataPacket,
        106: PopupMessagePacket,
        107: PromptPacket,
        108: PlayersOnMiniMapPacket,
        109: MiniMapMarkerPacket,
        111: SocketMessagesPacket,
        112: GameRoomPropertyUpdatePacket,
        113: DisconnectOnExceedingRateLimitPacket,
        114: PumpkinsOnMiniMapPacket,
        255: KeepAliveResponsePacket,
    },
};

function getPacketTarget(direction, header) {
    const packetRegistry = Registry[direction];
    if (!packetRegistry) {
        return null;
    }

    return packetRegistry[header] || null;
}

function parsePacket(direction, data) {
    const view = data instanceof DataView ? data : new DataView(data);
    const header = view.byteLength > 0 ? view.getUint8(0) : null;
    const Target = header == null ? null : getPacketTarget(direction, header);
    let parsedPacket = header == null
        ? null
        : new Packet(view).setDirection(direction).setPacketClass(Target || Packet);
    let parsingError = null;

    if (typeof Target === 'function') {
        try {
            parsedPacket = new Target(view);
            if (!(parsedPacket instanceof Packet)) {
                parsedPacket = Object.assign(
                    new Packet(view).setDirection(direction).setPacketClass(Target),
                    parsedPacket || {}
                );
            }

            parsedPacket
                .setDirection(direction)
                .setPacketClass(Target);

            if (parsedPacket && parsedPacket.parsingError) {
                parsingError = parsedPacket.parsingError;
            }
        } catch (error) {
            parsingError = error && error.message ? error.message : String(error);
            parsedPacket = new Packet(view)
                .setDirection(direction)
                .setPacketClass(Target)
                .setParsingError(parsingError)
                .finish();
        }
    }

    return {
        view,
        header,
        Target,
        parsedPacket,
        parsingError,
    };
}
