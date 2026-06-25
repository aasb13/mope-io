class PromptPacket extends Packet {
    constructor(view) {
        super(view, 1);
        const packetUtil = this.packetUtil;
        this.prompt = packetUtil.readString();
        this.defaultPrompt = this.prompt || 'Provide a reason';

        this.finish();
    }
}
