import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List my API keys' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeysService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create API key (raw key returned once)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update API key' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: Partial<CreateApiKeyDto>,
  ) {
    return this.apiKeysService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke API key' })
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.apiKeysService.revoke(id, user.userId);
  }
}
