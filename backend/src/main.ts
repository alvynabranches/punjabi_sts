import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';  // Fix the import path

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3001);
  console.log('Application is running on port 3001');
}
bootstrap();