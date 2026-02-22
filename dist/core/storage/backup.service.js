"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeBackupService = exports.HttpBackupService = exports.FileBackupService = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const database_path_1 = require("./database.path");
class FileBackupService {
    constructor(sourcePath = (0, database_path_1.resolveDatabasePath)(), targetDir) {
        this.sourcePath = sourcePath;
        this.targetDir = targetDir ?? node_path_1.default.resolve(process.cwd(), 'backups');
    }
    async backup() {
        await promises_1.default.mkdir(this.targetDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `zip-backup-${timestamp}.db`;
        await promises_1.default.copyFile(this.sourcePath, node_path_1.default.join(this.targetDir, fileName));
    }
}
exports.FileBackupService = FileBackupService;
class HttpBackupService {
    constructor(sourcePath, endpoint, token) {
        this.sourcePath = sourcePath;
        this.endpoint = endpoint;
        this.token = token;
    }
    async backup() {
        const bytes = await promises_1.default.readFile(this.sourcePath);
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/octet-stream',
                ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
            },
            body: bytes,
        });
        if (!response.ok) {
            throw new Error(`HTTP backup failed: ${response.status} ${response.statusText}`);
        }
    }
}
exports.HttpBackupService = HttpBackupService;
class CompositeBackupService {
    constructor(services) {
        this.services = services;
    }
    async backup() {
        for (const service of this.services) {
            await service.backup();
        }
    }
}
exports.CompositeBackupService = CompositeBackupService;
