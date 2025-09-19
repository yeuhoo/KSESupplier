# PostgreSQL Integration - Step-by-Step Implementation

## Overview
This guide provides a clear, sequential approach to implementing PostgreSQL integration. We'll start with the foundation and build up to a fully functional system.

## Prerequisites
- Node.js and npm installed
- PostgreSQL server running (local or cloud)
- Access to your Shopify store admin

---

## Step 1: Install Dependencies
**Goal**: Add PostgreSQL and TypeORM support to your project

```bash
# Install required packages
npm install @nestjs/typeorm typeorm pg
npm install --save-dev @types/pg

# Optional: For database migrations
npm install typeorm-extension
```

**What this does**: Adds TypeORM for database operations and PostgreSQL driver

---

## Step 2: Environment Configuration
**Goal**: Set up database connection settings

Create/update `.env` file:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=kse_user
DB_PASSWORD=your_secure_password
DB_DATABASE=kse_shopify
DB_SYNCHRONIZE=true
DB_LOGGING=true

# Existing Shopify Configuration (keep these)
SHOPIFY_API_URL=https://kse-suppliers.myshopify.com/admin/api/2024-01/graphql.json
SHOPIFY_ACCESS_TOKEN=your_token
SHOPIFY_REST_API_URL=https://kse-suppliers.myshopify.com/admin/api/2024-01
SHOPIFY_REST_API_URL_2=https://kse-suppliers.myshopify.com/admin/api/2024-01
```

**What this does**: Configures database connection parameters

---

## Step 3: Database Setup
**Goal**: Create PostgreSQL database and user

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE kse_shopify;
CREATE USER kse_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE kse_shopify TO kse_user;
```

**Alternative**: Use a cloud service like Railway, Supabase, or Neon for easier setup.

**What this does**: Creates the database and user for your application

---

## Step 4: Create Core Entities
**Goal**: Define database schema for customers and draft orders

Create `src/entities/customer.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('customers')
@Index(['shopifyGid'], { unique: true })
@Index(['company'])
@Index(['priceLevel'])
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  shopifyGid: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'jsonb', nullable: true })
  addresses: any[];

  @Column({ type: 'jsonb', nullable: true })
  defaultAddress: any;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  priceLevel: string;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;
}
```

Create `src/entities/draft-order.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('draft_orders')
@Index(['shopifyGid'], { unique: true })
@Index(['customerGid'])
@Index(['createdAt'])
export class DraftOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  shopifyGid: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  note: string;

  @Column({ nullable: true })
  customerGid: string;

  @Column({ type: 'jsonb', nullable: true })
  shippingAddress: any;

  @Column({ type: 'jsonb', nullable: true })
  lineItems: any[];

  @Column({ nullable: true })
  invoiceUrl: string;

  @Column({ type: 'timestamp', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;
}
```

**What this does**: Defines the database schema for your core data

---

## Step 5: Database Module Setup
**Goal**: Configure TypeORM connection

Create `src/database/database.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Customer } from '../entities/customer.entity';
import { DraftOrder } from '../entities/draft-order.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [Customer, DraftOrder],
        synchronize: configService.get('DB_SYNCHRONIZE'),
        logging: configService.get('DB_LOGGING'),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Customer, DraftOrder]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
```

Update `src/app.module.ts`:
```typescript
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    // ... existing imports
    DatabaseModule,
    // ... rest of your imports
  ],
  // ... rest of your module
})
export class AppModule {}
```

**What this does**: Connects your app to PostgreSQL using TypeORM

---

## Step 6: Create Repositories
**Goal**: Add data access layer

Create `src/repositories/customer.repository.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';

@Injectable()
export class CustomerRepository {
  constructor(
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  async findAll(): Promise<Customer[]> {
    return this.customerRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByShopifyGid(shopifyGid: string): Promise<Customer | null> {
    return this.customerRepo.findOne({
      where: { shopifyGid },
    });
  }

  async upsertFromShopify(shopifyCustomer: any): Promise<Customer> {
    const customer = this.customerRepo.create({
      shopifyGid: shopifyCustomer.id,
      firstName: shopifyCustomer.firstName,
      lastName: shopifyCustomer.lastName,
      email: shopifyCustomer.email,
      addresses: shopifyCustomer.addresses,
      defaultAddress: shopifyCustomer.defaultAddress,
      company: shopifyCustomer.defaultAddress?.company,
      priceLevel: shopifyCustomer.priceLevel,
      tags: shopifyCustomer.tags || [],
      lastSyncedAt: new Date(),
    });

    return this.customerRepo.save(customer);
  }
}
```

**What this does**: Provides clean data access methods for customers

---

## Step 7: Refactor AppService (Start with getCustomers)
**Goal**: Make getCustomers() use PostgreSQL first, Shopify as fallback

Update `src/app.service.ts`:
```typescript
import { CustomerRepository } from './repositories/customer.repository';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly customerRepo: CustomerRepository,
  ) {
    // ... existing constructor code
  }

  // Helper method to map Customer entity to User model
  private mapCustomerToUser(customer: Customer): User {
    return {
      id: customer.shopifyGid,
      firstName: customer.firstName || 'N/A',
      lastName: customer.lastName || 'N/A',
      email: customer.email || 'N/A',
      addresses: customer.addresses || [],
      defaultAddress: customer.defaultAddress,
      priceLevel: customer.priceLevel || 'N/A',
    };
  }

  // Updated getCustomers method
  async getCustomers(): Promise<User[]> {
    try {
      // Try to get from PostgreSQL first
      const customers = await this.customerRepo.findAll();
      
      // Check if data is fresh (less than 5 minutes old)
      const isDataFresh = customers.length > 0 && 
        customers[0].lastSyncedAt && 
        (Date.now() - customers[0].lastSyncedAt.getTime()) < 300000;

      // If data is stale, trigger background sync
      if (!isDataFresh && customers.length > 0) {
        this.syncCustomersFromShopify().catch(console.error);
      }

      // If no data in database, fetch from Shopify
      if (customers.length === 0) {
        return this.getCustomersFromShopify();
      }

      return customers.map(this.mapCustomerToUser);
    } catch (error) {
      console.error('Error fetching customers from database:', error);
      // Fallback to Shopify
      return this.getCustomersFromShopify();
    }
  }

  // Keep existing Shopify method as fallback
  private async getCustomersFromShopify(): Promise<User[]> {
    // ... your existing Shopify API call logic
    const response = await axios({
      url: this.shopifyApiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.shopifyAccessToken,
      },
      data: {
        query: `
          {
            customers(first: 100) {
              edges {
                node {
                  id
                  firstName
                  lastName
                  email
                  addresses {
                    address1
                    address2
                    company
                    city
                    province
                    country
                    zip
                  }
                  defaultAddress {
                    address1
                    address2
                    company
                    city
                    province
                    country
                    zip
                  }
                  tags
                }
              }
            }
          }
        `,
      },
    });

    const customers = response.data.data.customers.edges.map((edge) => ({
      id: edge.node.id,
      firstName: edge.node.firstName || 'N/A',
      lastName: edge.node.lastName || 'N/A',
      email: edge.node.email || 'N/A',
      addresses: edge.node.addresses.map((address) => ({
        address1: address.address1,
        address2: address.address2,
        company: address.company,
        city: address.city,
        province: address.province,
        country: address.country,
        zip: address.zip,
      })),
      defaultAddress: edge.node.defaultAddress,
      priceLevel: edge.node.tags && edge.node.tags[0] ? edge.node.tags[0].trim() : 'N/A',
    }));

    return customers;
  }

  // New method to sync customers from Shopify
  private async syncCustomersFromShopify(): Promise<void> {
    try {
      const shopifyCustomers = await this.getCustomersFromShopify();
      
      for (const customer of shopifyCustomers) {
        await this.customerRepo.upsertFromShopify(customer);
      }
      
      console.log(`Synced ${shopifyCustomers.length} customers from Shopify`);
    } catch (error) {
      console.error('Error syncing customers from Shopify:', error);
    }
  }
}
```

**What this does**: Makes getCustomers() fast by using PostgreSQL, with Shopify as backup

---

## Step 8: Test Basic Integration
**Goal**: Verify PostgreSQL connection and basic functionality

1. **Start your application**:
```bash
npm run start:dev
```

2. **Check database connection**: Look for successful connection logs

3. **Test getCustomers endpoint**: 
   - First call will fetch from Shopify and store in PostgreSQL
   - Subsequent calls should be much faster (from PostgreSQL)

4. **Verify data in database**:
```sql
SELECT * FROM customers LIMIT 5;
SELECT COUNT(*) FROM customers;
```

**What this does**: Validates that the basic integration works correctly

---

## Step 9: Extend to Draft Orders
**Goal**: Apply same pattern to draft orders

Create `src/repositories/draft-order.repository.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DraftOrder } from '../entities/draft-order.entity';

@Injectable()
export class DraftOrderRepository {
  constructor(
    @InjectRepository(DraftOrder)
    private draftOrderRepo: Repository<DraftOrder>,
  ) {}

  async findAll(): Promise<DraftOrder[]> {
    return this.draftOrderRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByCustomerId(customerId: string): Promise<DraftOrder[]> {
    return this.draftOrderRepo.find({
      where: { customerGid: customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async upsertFromShopify(shopifyDraftOrder: any): Promise<DraftOrder> {
    const draftOrder = this.draftOrderRepo.create({
      shopifyGid: shopifyDraftOrder.id,
      name: shopifyDraftOrder.name,
      note: shopifyDraftOrder.note,
      customerGid: shopifyDraftOrder.customer?.id,
      shippingAddress: shopifyDraftOrder.shippingAddress,
      lineItems: shopifyDraftOrder.lineItems,
      invoiceUrl: shopifyDraftOrder.invoiceUrl,
      createdAt: shopifyDraftOrder.createdAt,
      updatedAt: shopifyDraftOrder.updatedAt,
      completedAt: shopifyDraftOrder.completedAt,
      lastSyncedAt: new Date(),
    });

    return this.draftOrderRepo.save(draftOrder);
  }
}
```

Update `getDraftOrders()` method in AppService:
```typescript
async getDraftOrders(): Promise<DraftOrder[]> {
  try {
    const draftOrders = await this.draftOrderRepo.findAll();
    
    const isDataFresh = draftOrders.length > 0 && 
      draftOrders[0].lastSyncedAt && 
      (Date.now() - draftOrders[0].lastSyncedAt.getTime()) < 300000;

    if (!isDataFresh && draftOrders.length > 0) {
      this.syncDraftOrdersFromShopify().catch(console.error);
    }

    if (draftOrders.length === 0) {
      return this.getDraftOrdersFromShopify();
    }

    return draftOrders.map(this.mapDraftOrderToGraphQL);
  } catch (error) {
    console.error('Error fetching draft orders from database:', error);
    return this.getDraftOrdersFromShopify();
  }
}
```

**What this does**: Extends the PostgreSQL pattern to draft orders

---

## Step 10: Implement Data Sync Strategy
**Goal**: Keep PostgreSQL data fresh with Shopify

Create `src/sync/sync.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomerRepository } from '../repositories/customer.repository';
import { DraftOrderRepository } from '../repositories/draft-order.repository';
import { AppService } from '../app.service';

@Injectable()
export class SyncService {
  constructor(
    private readonly customerRepo: CustomerRepository,
    private readonly draftOrderRepo: DraftOrderRepository,
    private readonly appService: AppService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncAllData() {
    console.log('Starting scheduled sync...');
    
    try {
      await Promise.all([
        this.syncCustomers(),
        this.syncDraftOrders(),
      ]);
      
      console.log('Scheduled sync completed successfully');
    } catch (error) {
      console.error('Error during scheduled sync:', error);
    }
  }

  private async syncCustomers() {
    const shopifyCustomers = await this.appService.getCustomersFromShopify();
    
    for (const customer of shopifyCustomers) {
      await this.customerRepo.upsertFromShopify(customer);
    }
    
    console.log(`Synced ${shopifyCustomers.length} customers`);
  }

  private async syncDraftOrders() {
    const shopifyDraftOrders = await this.appService.getDraftOrdersFromShopify();
    
    for (const draftOrder of shopifyDraftOrders) {
      await this.draftOrderRepo.upsertFromShopify(draftOrder);
    }
    
    console.log(`Synced ${shopifyDraftOrders.length} draft orders`);
  }
}
```

Add to `app.module.ts`:
```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { SyncService } from './sync/sync.service';

@Module({
  imports: [
    // ... existing imports
    ScheduleModule.forRoot(),
  ],
  providers: [
    // ... existing providers
    SyncService,
  ],
})
export class AppModule {}
```

**What this does**: Keeps your PostgreSQL data synchronized with Shopify

---

## Testing & Validation

### Performance Test
```bash
# Test with multiple concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ getCustomers { id firstName lastName } }"}' &
done
wait
```

### Expected Results
- **First request**: ~2-3 seconds (fetches from Shopify)
- **Subsequent requests**: ~50-200ms (from PostgreSQL)
- **No rate limit errors**: Even with 100+ concurrent users

---

## Next Steps After Basic Implementation

1. **Add webhooks** for real-time updates
2. **Implement pagination** for large datasets
3. **Add caching layer** (Redis) for even better performance
4. **Set up monitoring** and health checks
5. **Add database indexes** for query optimization

---

## Troubleshooting

### Common Issues:
1. **Database connection failed**: Check environment variables and PostgreSQL status
2. **Entity not found**: Ensure entities are imported in DatabaseModule
3. **Data not syncing**: Check Shopify API credentials and network connectivity
4. **Performance not improved**: Verify queries are hitting PostgreSQL, not Shopify

### Debug Commands:
```bash
# Check database connection
psql -h localhost -U kse_user -d kse_shopify

# View application logs
npm run start:dev

# Check database tables
\dt
SELECT COUNT(*) FROM customers;
```

This step-by-step approach ensures you build a solid foundation and can validate each component before moving to the next step.
