import { Module, forwardRef } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { AppGateway } from './app.gateway';

@Module({
  imports: [forwardRef(() => MessagingModule)],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class GatewayModule {}
