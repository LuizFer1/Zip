"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHasherImpl = void 0;
const crypto_1 = require("crypto");
class EventHasherImpl {
    hash(data) {
        return (0, crypto_1.createHash)("sha256")
            .update(data)
            .digest("hex");
    }
}
exports.EventHasherImpl = EventHasherImpl;
