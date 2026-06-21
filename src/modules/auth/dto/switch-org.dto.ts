import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SwitchOrgDto {
  @ApiProperty({ description: 'Organization ID to switch active workspace to' })
  @IsString()
  organizationId!: string;
}
