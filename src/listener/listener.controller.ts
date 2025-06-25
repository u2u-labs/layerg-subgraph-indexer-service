import { Controller } from '@nestjs/common';
import { ListenerService } from './listener.service';

@Controller('listener')
export class ListenerController {
  constructor(private readonly listenerService: ListenerService) {}
}
