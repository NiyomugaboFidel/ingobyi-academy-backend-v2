import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { ttl: 60000, limit: 60 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register with email + OTP' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and issue tokens' })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifyOtp(dto.email, dto.code, res, dto.purpose);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Email/password login' })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.login(dto, res, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token' })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(req.cookies?.ia_refresh, res);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and clear session' })
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.logout(req.cookies?.ia_refresh, res, user.userId);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth initiate' })
  googleAuth() {
    return;
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = req.user as {
      googleId: string;
      email: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
    };
    return this.authService.handleGoogleUser(profile, res);
  }

  @Public()
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend verification or reset OTP' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email, dto.purpose);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Send password reset OTP' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user with active workspace' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  @Post('switch-org')
  @ApiOperation({ summary: 'Switch active workspace (body)' })
  switchOrgBody(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SwitchOrgDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.switchOrg(user.userId, dto.organizationId, res);
  }

  @Post('switch-org/:orgId')
  @ApiOperation({ summary: 'Switch active org context (legacy path param)' })
  switchOrg(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId', ParseCuidPipe) orgId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.switchOrg(user.userId, orgId, res);
  }
}
