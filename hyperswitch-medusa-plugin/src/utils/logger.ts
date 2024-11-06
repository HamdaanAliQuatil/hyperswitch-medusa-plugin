import { Logger } from '@medusajs/framework/types';
import chalk from 'chalk';

interface ChalkLogger extends Logger {
  panic: (data: any) => void;
  shouldLog: (level: string) => boolean;
  setLogLevel: (level: string) => void;
  unsetLogLevel: () => void;
  activity: (message: string, config?: Record<string, any>) => string;
  progress: (activityId: string, message: string) => void;
  error: (messageOrError: string | Error, error?: Error) => void;
  failure: (activityId: string, message: string) => Record<string, any> | null;
  success: (activityId: string, message: string) => Record<string, any> | null;
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  log: (...args: any[]) => void;
}

const createChalkLogger = (logger: Logger): ChalkLogger => {
  const logLevels = {
    panic: chalk.bgRed.white,
    error: chalk.red,
    failure: chalk.red,
    warn: chalk.yellow,
    info: chalk.blue,
    debug: chalk.gray,
    success: chalk.green,
    activity: chalk.cyan,
    progress: chalk.cyan,
    log: chalk.white,
  };

  return {
    panic: (data) => logger.panic(data),
    shouldLog: (level) => logger.shouldLog(level),
    setLogLevel: (level) => logger.setLogLevel(level),
    unsetLogLevel: () => logger.unsetLogLevel(),
    activity: (message, config) => logger.activity(message, config),
    progress: (activityId, message) => logger.progress(activityId, message),
    error: (messageOrError, error) => {
      if (typeof messageOrError === 'string') {
        logger.error(logLevels.error(messageOrError), error);
      } else {
        logger.error(logLevels.error(messageOrError.message), messageOrError);
      }
    },
    failure: (activityId, message) => logger.failure(activityId, logLevels.failure(message)),
    success: (activityId, message) => logger.success(activityId, logLevels.success(message)),
    debug: (message) => logger.debug(logLevels.debug(message)),
    info: (message) => logger.info(logLevels.info(message)),
    warn: (message) => logger.warn(logLevels.warn(message)),
    log: (...args) => logger.log(logLevels.log(args.join(' '))),
  };
};

export default createChalkLogger;
