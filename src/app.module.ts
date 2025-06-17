import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CacheableMemory } from 'cacheable';
import { AppService } from './app.service';
import { WebhooksModule } from './webhooks/webhooks.module';
import { QueryModule } from './query/query.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv, Keyv } from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        return {
          stores: [
            new Keyv({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
              store: new CacheableMemory({
                ttl: 1000,
                lruSize: 5000,
              }),
            }),
            createKeyv('redis://localhost:6379'),
          ],
        };
      },
    }),
    WebhooksModule,
    QueryModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
