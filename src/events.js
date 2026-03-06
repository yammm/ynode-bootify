/**
 * Remove an event listener from an EventEmitter-like target.
 * Supports both modern `off()` and legacy `removeListener()`.
 */
export function off(target, event, handler) {
    if (!target || typeof handler !== "function") {
        return;
    }

    if (typeof target.off === "function") {
        target.off(event, handler);
        return;
    }

    if (typeof target.removeListener === "function") {
        target.removeListener(event, handler);
    }
}
