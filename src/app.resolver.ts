import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppService } from './app.service';
import { Product } from './product.model';
import { User } from './user.model';
import { DraftOrder, LineItem, Variant } from './draft-order.model';
import { MetafieldInput } from './dto/metafield.input';
import { ShippingAddressInput } from './dto/shipping-address.input';
import { DraftOrderInput, LineItemInput } from './dto/draft-order.input';
import { PropertyInput } from './dto/property.input';
import { DraftOrderTag } from './dto/draft-order-tag.model';
import { CustomerCompany } from './dto/customer-company.dto';
import { title } from 'process';

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
async getDraftOrder(@Args('id', { type: () => String }) id: string): Promise<DraftOrder> {
  return this.appService.getDraftOrderById(id);
}

@Mutation(() => Boolean)
async requestShippingFee(
  @Args('userId') userId: string,
  @Args('draftOrderId') draftOrderId: string,
  @Args('email', { type: () => String }) email: string,
  @Args('shippingAddress', { type: () => ShippingAddressInput }) shippingAddress: ShippingAddressInput
): Promise<boolean> {
  try {
    await this.appService.updateDraftOrderAddress(draftOrderId, shippingAddress, email);

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

  @Query(() => [CustomerCompany])
async getCustomersWithCompanies(): Promise<{ id: string; company: string }[]> {
  return this.appService.getCustomersWithCompanies();
}


@Query(() => [DraftOrder], { nullable: true })
async getDraftOrdersByCustomerId(
  @Args('customerId', { type: () => String }) customerId: string,
  @Args('includeTags', { type: () => [String], nullable: true }) includeTags?: string[],
  @Args('excludeTags', { type: () => [String], nullable: true }) excludeTags?: string[]
): Promise<DraftOrder[]> {
  // Ensure the customerId is correctly formatted
  const formattedCustomerId = customerId.startsWith('gid://shopify/Customer/')
    ? customerId
    : `gid://shopify/Customer/${customerId}`;

  // Fetch all draft orders
  const allDraftOrders = await this.appService.newGetDraftOrders();

  // Debugging output to ensure data is correct
  console.log('All Draft Orders:', JSON.stringify(allDraftOrders, null, 2));

  // Filter orders by customer ID
  let filteredOrders = allDraftOrders.filter((order) => order.customer?.id === formattedCustomerId);

  console.log('Filtered Orders by Customer:', JSON.stringify(filteredOrders, null, 2));

  // Filter by included tags if specified
  if (includeTags?.length) {
    const includeSet = new Set(includeTags);
    filteredOrders = filteredOrders.filter((order) =>
      (order.tags || []).some((tag) => includeSet.has(tag))
    );
    console.log('Filtered Orders by Include Tags:', JSON.stringify(filteredOrders, null, 2));
  }

  // Filter by excluded tags if specified
  if (excludeTags?.length) {
    const excludeSet = new Set(excludeTags);
    filteredOrders = filteredOrders.filter(
      (order) => !(order.tags || []).some((tag) => excludeSet.has(tag))
    );
    console.log('Filtered Orders by Exclude Tags:', JSON.stringify(filteredOrders, null, 2));
  }

  return filteredOrders;
}

  @Query(() => [DraftOrder], { nullable: true })
async getAllDraftOrdersWithTags(
  @Args('includeTags', { type: () => [String], nullable: true }) includeTags?: string[],
  @Args('excludeTags', { type: () => [String], nullable: true }) excludeTags?: string[]
): Promise<DraftOrder[]> {
  const allDraftOrders = await this.appService.newGetDraftOrders();

  let filteredOrders = allDraftOrders;

  if (includeTags?.length) {
    const includeSet = new Set(includeTags);
    filteredOrders = filteredOrders.filter((order) =>
      (order.tags || []).some((tag) => includeSet.has(tag))
    );
  }

  if (excludeTags?.length) {
    const excludeSet = new Set(excludeTags);
    filteredOrders = filteredOrders.filter(
      (order) => !(order.tags || []).some((tag) => excludeSet.has(tag))
    );
  }

  return filteredOrders;
}



@Query(() => [DraftOrder])
async draftOrders() {
  try {
    const draftOrders = await this.appService.getDraftOrders();

    return draftOrders.map((order) => ({
      id: order.id,
      name: order.name || null,
      customer: order.customer
        ? {
            id: order.customer.id || "N/A",
            firstName: order.customer.firstName || "N/A",
            lastName: order.customer.lastName || "N/A",
            email: order.customer.email || "N/A",
          }
        : null,
      invoiceUrl: order.invoiceUrl || null,
      createdAt: order.createdAt || null,
      lineItems: order.lineItems?.map((item) => ({
        title: item.title || "N/A",
        quantity: item.quantity || 0,
        appliedDiscount: item.appliedDiscount
        ? {
            value: item.appliedDiscount.value || 0, 
            valueType: item.appliedDiscount.valueType || "N/A", 
          }
        : null,
        variant: {
          id: item.variant?.id || "N/A",
          title: item.variant?.title || "N/A",
          price: item.variant?.price || 0,
          metafields: item.variant?.metafields?.map((metafield) => ({
            key: metafield.key,
            value: metafield.value,
          })) || [],
        },
      })) || [],
      shippingAddress: order.shippingAddress
        ? {
            address1: order.shippingAddress.address1 || "N/A",
            city: order.shippingAddress.city || "N/A",
            province: order.shippingAddress.province || "N/A",
            company: order.shippingAddress.company || "N/A",
            country: order.shippingAddress.country || "N/A",
            zip: order.shippingAddress.zip || "N/A",
          }
        : null,
      metafields: order.metafields?.map((metafield) => ({
        id: metafield.id,
        namespace: metafield.namespace,
        key: metafield.key,
        value: metafield.value,
      })) || [],
    }));
  } catch (error) {
    console.error("Error fetching draft orders:", error.message);
    throw new Error("Failed to fetch draft orders.");
  }
}




@Query(() => String, { nullable: true }) // Adjust to return a nullable string
async checkForShippingFee(
  @Args('draftOrderId') draftOrderId: string
): Promise<string | null> {
  try {
    console.log('draftOrderId', draftOrderId);
    // Fetch the shipping fee
    const shippingFee = await this.appService.checkForShippingFee(draftOrderId);

    // Return formatted shipping fee if present
    if (shippingFee > 0) {
      return `$${shippingFee.toFixed(2)}`;
    } else {
      return null; // No shipping fee present
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
  @Args('note', { type: () => String, nullable: true }) note: string = '',
  @Args('email', { type: () => String, nullable: true }) email: string
): Promise<DraftOrder> {
  try {
    const draftOrder = await this.appService.createDraftOrder(
      customerId,
      lineItems,
      shippingAddress,
      metafields,
      note,
      email
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
    @Args('email', { type: () => String }) email: string,
    @Args('shippingAddress', { type: () => ShippingAddressInput }) shippingAddress: ShippingAddressInput
  ): Promise<boolean> {
    try {
      // First, update the draft order's shipping address
      await this.appService.updateDraftOrderAddress(draftOrderId, shippingAddress,email);

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
        @Args('tag') tag: string,
        @Args('userId') userId: string
    ): Promise<boolean> {
        try {
            await this.appService.createDraftOrderTag(draftOrderId, tag);

            if (tag === 'Placed') {
              await this.appService.placeOrderEmail(userId, draftOrderId);
            }
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
