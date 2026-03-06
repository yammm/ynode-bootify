export function createLogStub() {
    return {
        level: "info",
        fatal() {},
        error() {},
        warn() {},
        info() {},
        debug() {},
        trace() {},
        child() {
            return this;
        },
    };
}
