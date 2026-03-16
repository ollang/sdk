const isDebug = () =>
  typeof process !== 'undefined' &&
  (process.env.OLLANG_DEBUG === 'true' || process.env.DEBUG?.includes('ollang'));

export const logger = {
  debug(...args: unknown[]) {
    if (isDebug()) console.log('[ollang]', ...args);
  },

  info(...args: unknown[]) {
    console.log(...args);
  },

  warn(msg: string) {
    console.warn(msg);
  },

  error(msg: string, error?: unknown) {
    if (error instanceof Error) {
      console.error(msg, error.message);
      if (isDebug()) console.error(error.stack);
    } else if (error !== undefined) {
      console.error(msg, typeof error === 'string' ? error : '');
    } else {
      console.error(msg);
    }
  },
};
