import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { jwtExpiresInToMs } from '../../common/utils/jwt-expiry.util';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from '../user/dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestVerificationCodeDto } from './dto/request-verification-code.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private authCookieName(): string {
    return this.configService.get<string>('JWT_COOKIE_NAME')?.trim() || 'access_token';
  }

  private authCookieBase() {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '7d';
    const maxAgeMs = jwtExpiresInToMs(expiresIn);
    const sameSiteRaw = (
      this.configService.get<string>('JWT_COOKIE_SAMESITE') || 'lax'
    ).toLowerCase();
    const sameSite = (
      ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax'
    ) as 'lax' | 'strict' | 'none';
    const secureEnv = this.configService.get<string>('JWT_COOKIE_SECURE');
    let secure =
      secureEnv === 'true'
        ? true
        : secureEnv === 'false'
          ? false
          : this.configService.get<string>('NODE_ENV') === 'production';
    if (sameSite === 'none' && !secure) {
      secure = true;
    }
    const domain = this.configService.get<string>('JWT_COOKIE_DOMAIN')?.trim();
    return {
      maxAge: maxAgeMs,
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  private setAuthCookie(res: Response, accessToken: string) {
    const name = this.authCookieName();
    res.cookie(name, accessToken, {
      ...this.authCookieBase(),
    });
  }

  private clearAuthCookie(res: Response) {
    const name = this.authCookieName();
    const { maxAge: _maxAge, ...opts } = this.authCookieBase();
    res.clearCookie(name, opts);
  }

  @Public()
  @Post('signup')
  async signUp(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUp(createUserDto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('signup/agent')
  async signUpAgent(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUpAgent(createUserDto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('signup/admin')
  async signUpAdmin(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUpAdmin(createUserDto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent') || undefined,
    });
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('login/agent')
  async loginAgent(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginAgent(loginDto, {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent') || undefined,
    });
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear auth cookie',
    description:
      'Clears the httpOnly JWT cookie (same name as JWT_COOKIE_NAME, default access_token). Call from the browser with credentials.',
  })
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookie(res);
    return { message: 'Logged out' };
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('request-verification-code')
  async requestVerificationCode(@Body() dto: RequestVerificationCodeDto) {
    return this.authService.requestVerificationCode(dto);
  }
}
