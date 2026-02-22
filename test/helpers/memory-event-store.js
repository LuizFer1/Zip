class MemoryEventStore {
  constructor() {
    this.byId = new Map();
    this.byChannel = new Map();
  }

  async append(event) {
    this.byId.set(event.id, event);
    const list = this.byChannel.get(event.channelId) ?? [];
    list.push(event);
    list.sort((a, b) => a.timestamp - b.timestamp);
    this.byChannel.set(event.channelId, list);
  }

  async getById(id) {
    return this.byId.get(id) ?? null;
  }

  async getChannelEvents(channelId, options = {}) {
    const list = [...(this.byChannel.get(channelId) ?? [])];
    let filtered = list;

    if (options.types && options.types.length > 0) {
      const types = new Set(options.types);
      filtered = filtered.filter((event) => types.has(event.type));
    }

    if (typeof options.fromTimestamp === 'number') {
      filtered = filtered.filter((event) => event.timestamp >= options.fromTimestamp);
    }

    if (typeof options.toTimestamp === 'number') {
      filtered = filtered.filter((event) => event.timestamp <= options.toTimestamp);
    }

    if (typeof options.limit === 'number') {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async listChannelIds() {
    return [...this.byChannel.keys()].sort();
  }

  async getLast(channelId) {
    const list = this.byChannel.get(channelId) ?? [];
    return list.length > 0 ? list[list.length - 1] : null;
  }

  async exists(id) {
    return this.byId.has(id);
  }
}

module.exports = { MemoryEventStore };
