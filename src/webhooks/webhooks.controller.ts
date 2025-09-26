import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
    constructor(private readonly webhooksService: WebhooksService) {}

    @Post('shopify/customers/update')
    @HttpCode(HttpStatus.OK)
    async customerUpdate(@Body() payload: any, @Headers('x-shopify-hmac-sha256') hmac: string) {
        await this.webhooksService.handleCustomerUpdate(payload, hmac);
        return { ok: true };
    }

    @Post('shopify/draft_orders/create')
    @HttpCode(HttpStatus.OK)
    async draftOrderCreate(@Body() payload: any, @Headers('x-shopify-hmac-sha256') hmac: string) {
        await this.webhooksService.handleDraftOrderCreate(payload, hmac);
        return { ok: true };
    }

    @Post('shopify/draft_orders/update')
    @HttpCode(HttpStatus.OK)
    async draftOrderUpdate(@Body() payload: any, @Headers('x-shopify-hmac-sha256') hmac: string) {
        await this.webhooksService.handleDraftOrderUpdate(payload, hmac);
        return { ok: true };
    }

    @Post('shopify/draft_orders/delete')
    @HttpCode(HttpStatus.OK)
    async draftOrderDelete(@Body() payload: any, @Headers('x-shopify-hmac-sha256') hmac: string) {
        await this.webhooksService.handleDraftOrderDelete(payload, hmac);
        return { ok: true };
    }
}


