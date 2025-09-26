import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CustomerRepository } from '../repositories/customer.repository';
import { DraftOrderRepository } from '../repositories/draft-order.repository';

@Injectable()
export class WebhooksService {
    constructor(
        private readonly configService: ConfigService,
        private readonly customerRepo: CustomerRepository,
        private readonly draftOrderRepo: DraftOrderRepository,
    ) {}

    private verify(payload: any, hmac: string): boolean {
        const secret = this.configService.get<string>('WEBHOOK_SECRET') || '';
        const digest = crypto
            .createHmac('sha256', secret)
            .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
            .digest('base64');
        return digest === hmac;
    }

    async handleCustomerUpdate(payload: any, hmac: string) {
        if (!this.verify(payload, hmac)) return;
        const c = payload?.customer || payload; // depends on topic format
        if (!c?.id) return;
        await this.customerRepo.upsertFromShopify({
            id: c.id,
            firstName: c.first_name,
            lastName: c.last_name,
            email: c.email,
            tags: typeof c.tags === 'string' ? c.tags.split(',').map((t: string) => t.trim()) : c.tags,
        });
    }

    async handleDraftOrderCreate(payload: any, hmac: string) {
        if (!this.verify(payload, hmac)) return;
        const o = payload?.draft_order || payload;
        if (!o?.admin_graphql_api_id) return;
        await this.draftOrderRepo.upsertFromShopify({
            id: o.admin_graphql_api_id,
            name: o.name,
            invoiceUrl: o.invoice_url,
            createdAt: o.created_at,
            completedAt: o.completed_at,
            status: o.status,
            lineItems: { edges: (o.line_items || []).map((li: any) => ({ node: { title: li.title, quantity: li.quantity, appliedDiscount: null, variant: { title: li.variant_title, price: li.price } } })) },
        });
    }

    async handleDraftOrderUpdate(payload: any, hmac: string) {
        return this.handleDraftOrderCreate(payload, hmac);
    }

    async handleDraftOrderDelete(payload: any, hmac: string) {
        if (!this.verify(payload, hmac)) return;
        const id = payload?.admin_graphql_api_id || payload?.id;
        if (!id) return;
        await this.draftOrderRepo.deleteByShopifyGid(id);
    }
}


