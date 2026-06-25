class MopEvent {
    constructor() {
        this.canceled = false;
        this.propagationStopped = false;
        this.timestamp = Date.now();
    }

    cancel() {
        this.canceled = true;
        return this;
    }

    stopPropagation() {
        this.propagationStopped = true;
        return this;
    }
}
