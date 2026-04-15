export const WS_COMMANDS = {
  STATS: 'stats',
  CONFIG: 'config_get',
  LOG: 'log_get',
  STATUS: 'status'
} as const;

export type CommandType = keyof typeof WS_COMMANDS;

export const DEFAULT_STATS_COMMAND = {
  message: WS_COMMANDS.STATS,
  samples: true,
  rf: true,
  Initial_delay: 0.7
};

export const DEFAULT_LOG_COMMAND = {
  message: WS_COMMANDS.LOG,
  level: 'debug'
};