import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class AttachmentDto {
  @ApiProperty()
  @IsString()
  url!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @IsString()
  filename!: string;

  @ApiPropertyOptional()
  @IsOptional()
  size?: number;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Rich text JSON or HTML content' })
  @IsString()
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plainText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional({
    description: 'Root message id when replying in a thread',
  })
  @IsOptional()
  @IsUUID()
  threadRootId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAnnouncement?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentionIds?: string[];

  @ApiPropertyOptional({ type: [AttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class EditMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plainText?: string;
}

export class ReactMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(16)
  emoji!: string;
}
