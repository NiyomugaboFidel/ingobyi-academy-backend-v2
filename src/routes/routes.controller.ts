import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RoutesService } from './routes.service';

@ApiTags('Routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all API endpoints' })
  list() {
    const routes = this.routesService.getAll();
    return {
      total: routes.length,
      swagger: '/api/docs',
      postman: '/api/routes/postman',
      routes,
      grouped: this.routesService.getGrouped(),
    };
  }

  @Public()
  @Get('postman')
  @ApiOperation({ summary: 'Postman collection JSON' })
  postmanRedirect() {
    return {
      message:
        'Import postman/Ingobyi-Academy-API.postman_collection.json from the backend folder',
      file: 'postman/Ingobyi-Academy-API.postman_collection.json',
    };
  }
}
