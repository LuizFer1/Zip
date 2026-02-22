"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagService = void 0;
class DagService {
    validateLinearChain(events) {
        const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
        const errors = [];
        for (let i = 0; i < ordered.length; i += 1) {
            const current = ordered[i];
            const previous = ordered[i - 1];
            if (!previous) {
                const hasPrev = current.prev.id.trim().length > 0 || current.prev.hash.trim().length > 0;
                if (hasPrev) {
                    errors.push(`Event ${current.id} must have empty prev as first event in channel`);
                }
                continue;
            }
            if (current.prev.id.trim().length === 0) {
                errors.push(`Event ${current.id} missing prev.id`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
exports.DagService = DagService;
