import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { configureCloudinary } from './integrations/cloudinary/cloudinary.config';

async function bootstrap() {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    configureCloudinary();
  }

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
