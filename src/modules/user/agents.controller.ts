import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { UserService } from './user.service';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';

@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly userService: UserService) {}

  /** Public directory: approved or active agents only (no auth). */
  @Public()
  @Get()
  list(@Query() query: ListAgentsQueryDto) {
    return this.userService.listPublicAgents(query);
  }

  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.userService.getPublicAgentById(id);
  }
}
