import { setDefaultResultOrder } from 'node:dns';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

/** Prefer IPv4 for outbound connections (many PaaS hosts have broken IPv6 routes to SMTP). */
setDefaultResultOrder('ipv4first');
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { configureCloudinary } from './integrations/cloudinary/cloudinary.config';
import { corsOriginDelegate } from './common/cors/cors.config';
import { setupSwagger } from './common/swagger/swagger.setup';

async function bootstrap() {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    configureCloudinary();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }
  /** Static pages (e.g. forgot-password.html) from project `public/`. */
  app.useStaticAssets(join(process.cwd(), 'public'), { index: false });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: corsOriginDelegate,
    credentials: true,
  });

  if (process.env.SWAGGER_ENABLED !== 'false') {
    setupSwagger(app);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  if (process.env.SWAGGER_ENABLED !== 'false') {
    // eslint-disable-next-line no-console
    console.log(`Swagger UI: http://localhost:${port}/api`);
  }
}
bootstrap();
