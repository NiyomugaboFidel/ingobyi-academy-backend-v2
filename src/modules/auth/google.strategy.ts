import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { EnvConfig } from '../../config/configuration';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<EnvConfig, true>) {
    super({
      clientID:
        config.get('GOOGLE_CLIENT_ID', { infer: true }) ||
        'google-oauth-not-configured',
      clientSecret:
        config.get('GOOGLE_CLIENT_SECRET', { infer: true }) ||
        'google-oauth-not-configured',
      callbackURL:
        config.get('GOOGLE_CALLBACK_URL', { infer: true }) ??
        'http://localhost:3001/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('No email from Google'), false);
      return;
    }
    done(null, {
      googleId: profile.id,
      email: email.toLowerCase(),
      firstName: profile.name?.givenName ?? 'User',
      lastName: profile.name?.familyName ?? '',
      avatarUrl: profile.photos?.[0]?.value,
    });
  }
}
