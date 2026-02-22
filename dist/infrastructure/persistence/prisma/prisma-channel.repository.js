"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaChannelRepository = void 0;
const prisma_client_1 = require("../../../core/storage/prisma.client");
const channel_mapper_1 = require("./channel.mapper");
class PrismaChannelRepository {
    constructor(db = prisma_client_1.prisma) {
        this.db = db;
    }
    async list() {
        const rows = await this.db.channel.findMany({
            orderBy: { createdAt: 'asc' },
        });
        return rows.map((row) => channel_mapper_1.ChannelMapper.toDomain(row));
    }
    async createIfMissing(channel) {
        const row = await this.db.channel.upsert({
            where: { id: channel.id },
            update: {},
            create: {
                id: channel.id,
                creator: channel.creator,
                createdAt: channel.createdAt,
            },
        });
        return channel_mapper_1.ChannelMapper.toDomain(row);
    }
}
exports.PrismaChannelRepository = PrismaChannelRepository;
