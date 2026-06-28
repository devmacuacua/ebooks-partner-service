import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { PartnerModule } from './partner/partner.module';
import { PartnerBookModule } from './partner-book/partner-book.module';
import { WebhookModule } from './webhook/webhook.module';
import { RevenueModule } from './revenue/revenue.module';
import { WidgetModule } from './widget/widget.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/partner/widget/v1/static',
    }),
    PrismaModule,
    ApiKeyModule,
    PartnerModule,
    PartnerBookModule,
    WebhookModule,
    RevenueModule,
    WidgetModule,
    RabbitMQModule,
  ],
})
export class AppModule {}
