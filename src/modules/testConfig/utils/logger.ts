type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = this.getTimestamp();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (args.length > 0) {
      const formattedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      });
      
      return `${prefix} ${message} ${formattedArgs.join(' ')}`;
    }
    
    return `${prefix} ${message}`;
  }

  info(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.info(this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage('error', message, ...args));
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, ...args));
    }
  }
}

export const logger = new Logger();