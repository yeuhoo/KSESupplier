import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';

@Injectable()
export class CustomerRepository {
    constructor(
        @InjectRepository(Customer)
        private readonly repo: Repository<Customer>,
    ) {}

    async findAll(): Promise<Customer[]> {
        return this.repo.find({ relations: ['company', 'defaultAddress'] });
    }

    async findByShopifyGid(shopifyGid: string): Promise<Customer | null> {
        return this.repo.findOne({ where: { shopifyGid }, relations: ['company', 'defaultAddress'] });
    }

    async upsertFromShopify(shopifyCustomer: any): Promise<Customer> {
        const payload: Partial<Customer> = {
            shopifyGid: shopifyCustomer.id,
            firstName: shopifyCustomer.firstName || null,
            lastName: shopifyCustomer.lastName || null,
            email: shopifyCustomer.email || null,
            priceLevel:
                Array.isArray(shopifyCustomer.tags) && shopifyCustomer.tags[0]
                    ? String(shopifyCustomer.tags[0]).trim()
                    : null,
            tags: shopifyCustomer.tags || [],
            lastSyncedAt: new Date(),
        } as any;

        await this.repo.upsert(payload, { conflictPaths: ['shopifyGid'] as any });
        return this.findByShopifyGid(String(shopifyCustomer.id)) as Promise<Customer>;
    }
}


