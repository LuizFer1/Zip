"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDatabasePath = resolveDatabasePath;
const node_path_1 = __importDefault(require("node:path"));
function resolveDatabasePath() {
    const rawValue = (process.env.ZIP_DB_PATH ?? process.env.DATABASE_URL ?? '').trim();
    if (!rawValue) {
        return node_path_1.default.join(process.cwd(), 'zip.db');
    }
    const value = rawValue.toLowerCase().startsWith('file:')
        ? rawValue.slice(5)
        : rawValue;
    if (!value) {
        return node_path_1.default.join(process.cwd(), 'zip.db');
    }
    return node_path_1.default.isAbsolute(value)
        ? value
        : node_path_1.default.resolve(process.cwd(), value);
}
