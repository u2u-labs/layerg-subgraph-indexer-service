import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CacheableMemory } from 'cacheable';
import { AppService } from './app.service';
import { GraphqlModule } from './graphql/graphql.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv, Keyv } from '@keyv/redis';
import { LoggerModule } from 'nestjs-pino';
import { Request, Response } from 'express';
import { SubgraphssModule } from './subgraphs/subgraphs.module';
import { ListenerModule } from './listener/listener.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
        serializers: {
          req(req: Request) {
            return {
              method: req.method,
              url: req.url,
              headers: {
                'user-agent': req.headers['user-agent'],
              },
            };
          },
          res(res: Response) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
        // customProps: (req) => ({
        //   userAgent: req.headers['user-agent'],
        //   customTag: 'API-Request',
        // }),
        // customSuccessMessage: (req, res) =>
        //   `${req.method} ${req.url} completed with ${res.statusCode}`,
        // customErrorMessage: (req, res, err) =>
        //   `${req.method} ${req.url} failed: ${err.message}`,
      },
    }),
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
    SubgraphssModule,
    GraphqlModule,
    PrismaModule,
    ListenerModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
