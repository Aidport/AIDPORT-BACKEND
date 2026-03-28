import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok', service: 'aidport' };
  }

  @Public()
  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
