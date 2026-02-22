"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
class StructuredLogger {
    constructor(scope) {
        this.scope = scope;
    }
    info(event, data) {
        this.log('info', event, data);
    }
    warn(event, data) {
        this.log('warn', event, data);
    }
    error(event, data) {
        this.log('error', event, data);
    }
    log(level, event, data) {
        const payload = {
            ts: new Date().toISOString(),
            level,
            event: `${this.scope}.${event}`,
            ...(data && Object.keys(data).length > 0 ? { data } : {}),
        };
        const serialized = JSON.stringify(payload);
        if (level === 'error') {
            console.error(serialized);
            return;
        }
        if (level === 'warn') {
            console.warn(serialized);
            return;
        }
        console.info(serialized);
    }
}
exports.StructuredLogger = StructuredLogger;
