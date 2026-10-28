import { Module } from '@nestjs/common';
import { ControlService } from './control/control.service';
import { ControlGateway } from './transport/control.gateway';
import { XPlaneService } from './xplane/xplane.service';
import { NativeBridgeService } from './native/native-bridge.service';

@Module({
  providers: [NativeBridgeService, XPlaneService, ControlService, ControlGateway],
})
export class AppModule {}
