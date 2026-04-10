import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { configureCloudinary } from './integrations/cloudinary/cloudinary.config';
import { setupSwagger } from './common/swagger/swagger.setup';

async function bootstrap() {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    configureCloudinary();
  }

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: process.env.FRONTEND_URL?.includes(',')
      ? process.env.FRONTEND_URL.split(',').map((s) => s.trim())
      : process.env.FRONTEND_URL || true,
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
