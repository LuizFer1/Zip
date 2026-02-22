"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaEventStore = void 0;
const event_sing_1 = require("../../../core/protocol/event.sing");
const events_validator_1 = require("../../../core/protocol/events.validator");
const prisma_client_1 = require("../../../core/storage/prisma.client");
const event_mapper_1 = require("./event.mapper");
class PrismaEventStore {
    constructor(validator = new events_validator_1.SimpleEventValidator(new event_sing_1.EventSignerImpl()), db = prisma_client_1.prisma) {
        this.validator = validator;
        this.db = db;
    }
    async append(event) {
        await this.validator.validate(event);
        await this.db.event.create({
            data: event_mapper_1.EventMapper.toPersistence(event),
        });
    }
    async getById(id) {
        const data = await this.db.event.findUnique({
            where: { id },
        });
        return data ? event_mapper_1.EventMapper.toDomain(data) : null;
    }
    async getChannelEvents(channelId, options = {}) {
        const where = { channelId };
        if (options.types && options.types.length > 0) {
            where.type = { in: options.types };
        }
        if (options.fromTimestamp !== undefined || options.toTimestamp !== undefined) {
            where.timestamp = {};
            if (options.fromTimestamp !== undefined) {
                where.timestamp.gte = options.fromTimestamp;
            }
            if (options.toTimestamp !== undefined) {
                where.timestamp.lte = options.toTimestamp;
            }
        }
        const rows = await this.db.event.findMany({
            where,
            orderBy: { timestamp: 'asc' },
            ...(options.limit !== undefined ? { take: options.limit } : {}),
        });
        return rows.map((row) => event_mapper_1.EventMapper.toDomain(row));
    }
    async getLast(channelId) {
        const row = await this.db.event.findFirst({
            where: { channelId },
            orderBy: { timestamp: 'desc' },
        });
        return row ? event_mapper_1.EventMapper.toDomain(row) : null;
    }
    async exists(id) {
        const row = await this.db.event.findUnique({
            where: { id },
            select: { id: true },
        });
        return row !== null;
    }
}
exports.PrismaEventStore = PrismaEventStore;
