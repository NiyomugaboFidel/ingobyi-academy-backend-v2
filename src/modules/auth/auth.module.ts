import { Module, Provider } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';

const providers: Provider[] = [AuthService];
if (process.env.GOOGLE_CLIENT_ID?.trim()) {
  providers.push(GoogleStrategy);
}

@Module({
  controllers: [AuthController],
  providers,
  exports: [AuthService],
})
export class AuthModule {}
