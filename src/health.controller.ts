import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
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

  /** Pretty forgot-password page (`public/forgot-password.html`). */
  @Public()
  @Get('forgot-password')
  @Redirect('/forgot-password.html', 302)
  forgotPasswordPage() {
    return;
  }
}
