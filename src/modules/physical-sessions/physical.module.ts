import { Module } from '@nestjs/common';
import { PhysicalController } from './physical.controller';
import { PhysicalService } from './physical.service';

@Module({
  controllers: [PhysicalController],
  providers: [PhysicalService],
  exports: [PhysicalService],
})
export class PhysicalModule {}
