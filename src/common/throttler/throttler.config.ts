import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import {
  getClientIp,
  getLoginAccountTracker,
  globalThrottleGenerateKey,
  loginThrottleGenerateKey,
  shouldSkipHealthThrottle,
  shouldSkipLoginThrottle,
} from './throttler.util';

export function createThrottlerConfig(config: ConfigService): ThrottlerModuleOptions {
  const disabled = config.get<string>('THROTTLE_DISABLED') === 'true';
  const ttl = Number(config.get<string>('THROTTLE_TTL_MS')) || 60_000;
  const globalLimit = Number(config.get<string>('THROTTLE_GLOBAL_LIMIT')) || 100;
  const loginLimit = Number(config.get<string>('THROTTLE_LOGIN_LIMIT')) || 5;

  return {
    throttlers: [
      {
        name: 'global',
        ttl,
        limit: globalLimit,
        getTracker: (req) => getClientIp(req),
        generateKey: globalThrottleGenerateKey,
        skipIf: (ctx) => {
          if (disabled) {
            return true;
          }
          return shouldSkipHealthThrottle(ctx);
        },
      },
      {
        name: 'login',
        ttl,
        limit: loginLimit,
        getTracker: (req) => getLoginAccountTracker(req),
        generateKey: loginThrottleGenerateKey,
        skipIf: (ctx) => {
          if (disabled) {
            return true;
          }
          return shouldSkipLoginThrottle(ctx);
        },
      },
    ],
  };
}
