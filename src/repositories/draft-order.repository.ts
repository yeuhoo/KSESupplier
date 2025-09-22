import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DraftOrder } from '../entities/draft-order.entity';

@Injectable()
export class DraftOrderRepository {
    constructor(
        @InjectRepository(DraftOrder)
        private readonly repo: Repository<DraftOrder>,
    ) {}

    async findAll(): Promise<DraftOrder[]> {
        return this.repo.find({ relations: ['customer', 'shippingAddress'] });
    }

    async findByCustomerShopifyGid(customerShopifyGid: string): Promise<DraftOrder[]> {
        return this.repo.find({
            where: { customer: { shopifyGid: customerShopifyGid } as any },
            relations: ['customer', 'shippingAddress'],
            order: { dateCreated: 'DESC' },
        });
    }
}


