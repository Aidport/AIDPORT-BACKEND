import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Bearer JWT security scheme name — use with @ApiBearerAuth('access-token') */
export const SWAGGER_BEARER = 'access-token';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Aidport API')
    .setDescription(
      'Logistics platform API: authentication, shippers, agents, shipments, quotes, admin, uploads (Cloudinary).',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Paste JWT from login / signup response',
        in: 'header',
      },
      SWAGGER_BEARER,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) =>
      methodKey,
  });

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'Aidport API Docs',
  });
}
