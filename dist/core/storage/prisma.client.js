"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_better_sqlite3_1 = require("@prisma/adapter-better-sqlite3");
const database_bootstrap_1 = require("./database.bootstrap");
const database_path_1 = require("./database.path");
const dbPath = (0, database_path_1.resolveDatabasePath)();
(0, database_bootstrap_1.bootstrapDatabase)();
const adapter = new adapter_better_sqlite3_1.PrismaBetterSqlite3({ url: dbPath });
exports.prisma = global.prisma ||
    new client_1.PrismaClient({
        adapter,
        log: ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    global.prisma = exports.prisma;
}
