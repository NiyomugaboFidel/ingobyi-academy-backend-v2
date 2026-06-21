import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AchievementsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
