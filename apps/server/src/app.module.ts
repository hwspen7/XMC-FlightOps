import { Module } from '@nestjs/common';
import { ControlService } from './control/control.service';
import { ControlGateway } from './transport/control.gateway';
import { XPlaneService } from './xplane/xplane.service';

@Module({
  providers: [XPlaneService, ControlService, ControlGateway],
})
export class AppModule {}
