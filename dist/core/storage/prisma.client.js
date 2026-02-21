"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_better_sqlite3_1 = require("@prisma/adapter-better-sqlite3");
const node_path_1 = __importDefault(require("node:path"));
const dbPath = node_path_1.default.join(process.cwd(), 'zip.db');
const adapter = new adapter_better_sqlite3_1.PrismaBetterSqlite3({ url: dbPath });
exports.prisma = global.prisma ||
    new client_1.PrismaClient({
        adapter,
        log: ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    global.prisma = exports.prisma;
}
