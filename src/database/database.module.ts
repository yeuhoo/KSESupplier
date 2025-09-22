import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const databaseUrl = configService.get<string>('DATABASE_URL');
                const synchronize = String(configService.get('DB_SYNCHRONIZE')) === 'true';
                const logging = String(configService.get('DB_LOGGING')) === 'true';
                const useSsl = String(configService.get('DB_SSL')) === 'true' || !!databaseUrl;

                if (databaseUrl) {
                    return {
                        type: 'postgres' as const,
                        url: databaseUrl,
                        autoLoadEntities: true,
                        synchronize,
                        logging,
                        ssl: useSsl ? { rejectUnauthorized: false } : false,
                    };
                }

                return {
                    type: 'postgres' as const,
                    host: configService.get<string>('DB_HOST'),
                    port: Number(configService.get('DB_PORT') || 5432),
                    username: configService.get<string>('DB_USERNAME'),
                    password: configService.get<string>('DB_PASSWORD'),
                    database: configService.get<string>('DB_DATABASE'),
                    autoLoadEntities: true,
                    synchronize,
                    logging,
                    ssl: useSsl ? { rejectUnauthorized: false } : false,
                };
            },
        }),
    ],
})
export class DatabaseModule {}


