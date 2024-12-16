import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppService } from './app.service';
import { Product } from './product.model';
import { User } from './user.model';
import { DraftOrder, LineItem } from './draft-order.model';
import { MetafieldInput } from './dto/metafield.input';
import { ShippingAddressInput } from './dto/shipping-address.input';
import { DraftOrderInput, LineItemInput } from './dto/draft-order.input';
import { PropertyInput } from './dto/property.input';
import { DraftOrderTag } from './dto/draft-order-tag.model';

@Resolver()
export class AppResolver {
  constructor(private readonly appService: AppService) {}

  @Query(() => [Product])
  async products() {
    return this.appService.getProducts();
  }

  @Query(() => [User])  
  async users() {
    return this.appService.getUsers();
  }

  @Query(() => User, { nullable: true })
async user(@Args('id') id: string) {
    const user = await this.appService.getUserById(id);
    return user;
}

@Query(() => DraftOrder, { nullable: true })
async getDraftOrder(@Args('id') id: string): Promise<DraftOrder> {
    return this.appService.getDraftOrderById(id);
}


@Mutation(() => Boolean)
async requestShippingFee(
  @Args('userId') userId: string,
  @Args('draftOrderId') draftOrderId: string,
  @Args('shippingAddress', { type: () => ShippingAddressInput }) shippingAddress: ShippingAddressInput
): Promise<boolean> {
  try {
    await this.appService.updateDraftOrderAddress(draftOrderId, shippingAddress);

    await this.appService.sendShippingRequestEmail(userId, draftOrderId);

    return true;
  } catch (error) {
    console.error('Error requesting shipping fee:', error.message);
    throw new Error('Failed to request shipping fee.');
  }
}

@Query(() => Boolean)
async isDraftOrderCompleted(@Args('id') id: string): Promise<boolean> {
  return this.appService.isDraftOrderCompleted(id);
}


@Query(() => [DraftOrder])
async draftOrders() {
  try {
    const draftOrders = await this.appService.getDraftOrders();
    return draftOrders.map(order => ({
      id: order.id,
      customerId: order.customerId,
      invoiceUrl: order.invoiceUrl,
      createdAt: order.createdAt,
      lineItems: order.lineItems.map(item => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price, // Include price
        variant_title: item.variant_title,
        currency: item.currency // Include currency
      })),
      metafields: order.metafields.map(metafield => ({
        id: metafield.id,
        namespace: metafield.namespace,
        key: metafield.key,
        value: metafield.value,
      })),
      shippingAddress: order.shippingAddress ? {
        address1: order.shippingAddress.address1,
        city: order.shippingAddress.city,
        province: order.shippingAddress.province,
        country: order.shippingAddress.country,
        zip: order.shippingAddress.zip,
      } : null,
      order: order.order,
    }));
  } catch (error) {
    console.error('Error fetching draft orders:', error.message);
    throw new Error('Failed to fetch draft orders.');
  }
}

@Query(() => String, { nullable: true })  // Assuming the shipping fee is a string, adjust if needed
async checkForShippingFee(@Args('draftOrderId') draftOrderId: string): Promise<string | null> {
  try {
    const shippingFee = await this.appService.checkForShippingFee(draftOrderId);

    if (shippingFee > 0) {
      return `$${shippingFee.toFixed(2)}`;
    } else {
      return null;  // No shipping fee present
    }
  } catch (error) {
    console.error('Error checking for shipping fee:', error.message);
    throw new Error('Failed to check for shipping fee.');
  }
}

@Mutation(() => DraftOrder)
async calculateDraftOrderById(
  @Args('draftOrderId') draftOrderId: string,
) {
  try {
    const draftOrder = await this.appService.calculateDraftOrderById(draftOrderId);
    return draftOrder;
  } catch (error) {
    console.error('Error calculating draft order:', error.message);
    throw new Error('Failed to calculate draft order.');
  }
}

@Mutation(() => DraftOrder)
async createDraftOrder(
  @Args('customerId') customerId: string,
  @Args('lineItems', { type: () => [LineItemInput] }) lineItems: LineItemInput[],
  @Args('shippingAddress', { type: () => ShippingAddressInput }) shippingAddress: ShippingAddressInput,
  @Args('metafields', { type: () => [MetafieldInput], nullable: true }) metafields: MetafieldInput[] = [],
  @Args('note', { type: () => String, nullable: true }) note: string = ''
): Promise<DraftOrder> {
  try {
    const draftOrder = await this.appService.createDraftOrder(
      customerId,
      lineItems,
      shippingAddress,
      metafields,
      note
    );

    if (!draftOrder) {
      throw new Error('Draft order creation failed.');
    }

    return draftOrder;
  } catch (error) {
    console.error('Error in createDraftOrder mutation:', error);
    throw new Error(`Failed to create draft order: ${error.response?.data?.message || error.message}`);
  }
}

  @Mutation(() => DraftOrder)
  async updateDraftOrder(
    @Args('id') id: string,
    @Args('customerId') customerId: string,  // Add the customerId
    @Args('lineItems', { type: () => [LineItemInput] }) lineItems: LineItemInput[],
    @Args('shippingAddress', { type: () => ShippingAddressInput, nullable: true }) shippingAddress: ShippingAddressInput,  // Add shippingAddress argument
    @Args('metafields', { type: () => [MetafieldInput], nullable: true }) metafields: any[] = []
  ) {
    try {
      const updatedDraftOrder = await this.appService.updateDraftOrder(id, customerId, lineItems, metafields, shippingAddress);  // Pass shippingAddress
      
      if (!updatedDraftOrder) {
        throw new Error('Draft order update failed.');
      }
      
      return {
        ...updatedDraftOrder,
        lineItems: updatedDraftOrder.lineItems.edges.map(edge => ({
          title: edge.node.title,
          quantity: edge.node.quantity,
        })),
        metafields: updatedDraftOrder.metafields.edges.map(edge => ({
          id: edge.node.id,
          namespace: edge.node.namespace,
          key: edge.node.key,
          value: edge.node.value,
        })),
        shippingAddress: updatedDraftOrder.shippingAddress ? {
          address1: updatedDraftOrder.shippingAddress.address1,
          city: updatedDraftOrder.shippingAddress.city,
          province: updatedDraftOrder.shippingAddress.province,
          country: updatedDraftOrder.shippingAddress.country,
          zip: updatedDraftOrder.shippingAddress.zip,
        } : null,
      };
    } catch (error) {
      console.error('Error in updateDraftOrder mutation:', error);
      throw new Error(`Failed to update draft order: ${error.response?.data?.message || error.message}`);
    }
  }
  
  @Mutation(() => String)
  async deleteDraftOrder(@Args('id') id: string) {
    try {
      const deletedId = await this.appService.deleteDraftOrder(id);
      return `Draft order with ID ${deletedId} was successfully deleted.`;
    } catch (error) {
      console.error('Error in deleteDraftOrder mutation:', error);
      throw new Error(`Failed to delete draft order: ${error.response?.data?.message || error.message}`);
    }
  }
  
  @Mutation(() => Boolean)
  async completeDraftOrder(
    @Args('id') draftOrderId: string,
    @Args('shippingAddress', { type: () => ShippingAddressInput }) shippingAddress: ShippingAddressInput
  ): Promise<boolean> {
    try {
      // First, update the draft order's shipping address
      await this.appService.updateDraftOrderAddress(draftOrderId, shippingAddress);

      // Then, complete the draft order
      const result = await this.appService.completeDraftOrder(draftOrderId);
      return result ? true : false;
    } catch (error) {
      console.error('Error completing draft order:', error.message);
      throw new Error('Failed to complete draft order.');
    }
  }


  //DRAFT ORDER TAGS
    @Mutation(() => Boolean)
    async createDraftOrderTag(
        @Args('draftOrderId') draftOrderId: string,
        @Args('tag') tag: string
    ): Promise<boolean> {
        try {
            await this.appService.createDraftOrderTag(draftOrderId, tag);
            return true; // Return true if tag creation is successful
        } catch (error) {
            console.error('Error creating draft order tag:', error.message);
            throw new Error('Failed to create draft order tag.');
        }
    }

  @Query(() => [DraftOrderTag])
  async getDraftOrderTags(@Args('draftOrderId') draftOrderId: string): Promise<DraftOrderTag[]> {
      return this.appService.getDraftOrderTags(draftOrderId);
  }

  @Mutation(() => DraftOrderTag)
  async updateDraftOrderTag(
      @Args('draftOrderId') draftOrderId: string,
      @Args('tag') tag: string
  ): Promise<DraftOrderTag> {
      return this.appService.updateDraftOrderTag(draftOrderId, tag);
  }
  
}