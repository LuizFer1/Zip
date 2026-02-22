type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  ts: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
}

export class StructuredLogger {
  constructor(private readonly scope: string) {}

  info(event: string, data?: Record<string, unknown>): void {
    this.log('info', event, data);
  }

  warn(event: string, data?: Record<string, unknown>): void {
    this.log('warn', event, data);
  }

  error(event: string, data?: Record<string, unknown>): void {
    this.log('error', event, data);
  }

  private log(level: LogLevel, event: string, data?: Record<string, unknown>): void {
    const payload: LogPayload = {
      ts: new Date().toISOString(),
      level,
      event: `${this.scope}.${event}`,
      ...(data && Object.keys(data).length > 0 ? { data } : {}),
    };

    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
      return;
    }
    if (level === 'warn') {
      console.warn(serialized);
      return;
    }
    console.info(serialized);
  }
}
