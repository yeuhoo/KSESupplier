import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { CustomerRepository } from './repositories/customer.repository';
import { DraftOrderRepository } from './repositories/draft-order.repository';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DatabaseModule } from './database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Address } from './entities/address.entity';
import { Company } from './entities/company.entity';
import { Country } from './entities/country.entity';
import { CustomerAddress } from './entities/customer-address.entity';
import { DraftOrder } from './entities/draft-order.entity';
import { DraftOrderTag } from './entities/draft-order-tag.entity';

@Module({
    imports: [
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'public'),
            serveRoot: '/graphiql',                   
        }),
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        DatabaseModule,
        TypeOrmModule.forFeature([
            Customer,
            Address,
            Company,
            Country,
            CustomerAddress,
            DraftOrder,
            DraftOrderTag,
        ]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
            playground: false
        }),
    ],
    providers: [AppService, AppResolver, CustomerRepository, DraftOrderRepository],
})
export class AppModule { }
