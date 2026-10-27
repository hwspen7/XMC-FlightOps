import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { settings } from './configuration/settings';

async function bootstrap(): Promise<void> {
  const tlsEnabled = Boolean(settings.tlsCertFile && settings.tlsKeyFile);
  if (Boolean(settings.tlsCertFile) !== Boolean(settings.tlsKeyFile)) {
    throw new Error('Both TLS_CERT_FILE and TLS_KEY_FILE are required for HTTPS');
  }
  if (settings.host === '0.0.0.0' && !tlsEnabled) {
    throw new Error('Refusing to expose an unencrypted control server on the LAN');
  }

  const httpsOptions = tlsEnabled ? {
    cert: readFileSync(resolve(settings.projectRoot, settings.tlsCertFile)),
    key: readFileSync(resolve(settings.projectRoot, settings.tlsKeyFile)),
  } : undefined;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { httpsOptions });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  const webRoot = resolve(settings.projectRoot, 'apps/web/dist');
  if (existsSync(webRoot)) app.useStaticAssets(webRoot);
  await app.listen(settings.port, settings.host);

  const logger = new Logger('Bootstrap');
  logger.log(`Listening on ${tlsEnabled ? 'https' : 'http'}://${settings.host}:${settings.port}`);
  logger.log(`Pairing code: ${settings.pairingCode}`);
  logger.log(`Simulator target: ${settings.xplaneHost}:${settings.xplanePort}`);
  if (!existsSync(webRoot)) logger.warn('Web build not found. Run pnpm build to serve the interface');
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
