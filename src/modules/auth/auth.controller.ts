import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signUp(@Body() createUserDto: CreateUserDto) {
    return this.authService.signUp(createUserDto);
  }

  @Public()
  @Post('signup/agent')
  async signUpAgent(@Body() createUserDto: CreateUserDto) {
    return this.authService.signUpAgent(createUserDto);
  }

  @Public()
  @Post('signup/admin')
  async signUpAdmin(@Body() createUserDto: CreateUserDto) {
    return this.authService.signUpAdmin(createUserDto);
  }

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    const cookieName = process.env.JWT_COOKIE_NAME || 'access_token';
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    res.cookie(cookieName, result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });
    return result;
  }

  @Public()
  @Post('login/agent')
  async loginAgent(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginAgent(loginDto);
    const cookieName = process.env.JWT_COOKIE_NAME || 'access_token';
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    res.cookie(cookieName, result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });
    return result;
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
