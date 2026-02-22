"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelMapper = void 0;
class ChannelMapper {
    static toDomain(row) {
        return {
            id: row.id,
            creator: row.creator,
            createdAt: row.createdAt,
        };
    }
}
exports.ChannelMapper = ChannelMapper;
