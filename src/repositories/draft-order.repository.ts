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

    async findByShopifyGid(shopifyGid: string): Promise<DraftOrder | null> {
        return this.repo.findOne({ where: { shopifyGid }, relations: ['customer', 'shippingAddress'] });
    }

    async findByCustomerShopifyGid(customerShopifyGid: string): Promise<DraftOrder[]> {
        return this.repo.find({
            where: { customer: { shopifyGid: customerShopifyGid } as any },
            relations: ['customer', 'shippingAddress'],
            order: { dateCreated: 'DESC' },
        });
    }

    // Upsert minimal fields from Shopify GraphQL draftOrder node
    async upsertFromShopify(node: any): Promise<void> {
        const payload: Partial<DraftOrder> = {
            shopifyGid: node.id,
            name: node.name || null,
            invoiceUrl: node.invoiceUrl || null,
            dateCreated: node.createdAt ? new Date(node.createdAt) : null,
            completedAt: node.completedAt ? new Date(node.completedAt) : null,
            status: node.status || null,
            lineItems: Array.isArray(node?.lineItems?.edges)
                ? node.lineItems.edges.map((e: any) => ({
                    title: e.node.title,
                    quantity: e.node.quantity,
                    appliedDiscount: e.node.appliedDiscount || null,
                    variant: e.node.variant
                        ? { title: e.node.variant.title, price: e.node.variant.price }
                        : null,
                }))
                : null,
        } as any;

        await this.repo.upsert(payload, { conflictPaths: ['shopifyGid'] as any });
    }
}


