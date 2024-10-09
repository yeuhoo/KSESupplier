import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppService } from './app.service';
import { Product } from './product.model';
import { User } from './user.model';
import { DraftOrder } from './draft-order.model';
import { LineItemInput } from './dto/line-item.input';
import { MetafieldInput } from './dto/metafield.input';
import { ShippingAddressInput } from './dto/shipping-address.input';

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

  @Mutation(() => DraftOrder)
  async createDraftOrder(
    @Args('customerId') customerId: string,
    @Args('lineItems', { type: () => [LineItemInput] }) lineItems: LineItemInput[],
    @Args('shippingAddress', { type: () => ShippingAddressInput }) shippingAddress: ShippingAddressInput,  // Add shippingAddress argument
    @Args('metafields', { type: () => [MetafieldInput], nullable: true }) metafields: any[] = [],  // Add metafields argument
  ) {
    try {
      const draftOrder = await this.appService.createDraftOrder(customerId, lineItems, shippingAddress, metafields);  // Pass shippingAddress and metafields
      
      if (!draftOrder) {
        throw new Error('Draft order creation failed.');
      }
      
      return {
        ...draftOrder,
        lineItems: draftOrder.lineItems.edges.map(edge => ({
          title: edge.node.title,
          quantity: edge.node.quantity,
        })),
        metafields: draftOrder.metafields.edges.map(edge => ({
          id: edge.node.id,
          namespace: edge.node.namespace,
          key: edge.node.key,
          value: edge.node.value,
        })),
      };
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
    @Args('metafields', { type: () => [MetafieldInput], nullable: true }) metafields: any[] = [],
    @Args('shippingAddress', { type: () => ShippingAddressInput, nullable: true }) shippingAddress: ShippingAddressInput  // Add shippingAddress argument
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
  
  @Mutation(() => DraftOrder)
  async completeDraftOrder(@Args('id') id: string) {
    try {
      const completedDraftOrder = await this.appService.completeDraftOrder(id);
  
      if (!completedDraftOrder) {
        throw new Error('Failed to complete draft order.');
      }
  
      return {
        ...completedDraftOrder,
        order: completedDraftOrder.order,  // Include the order in the response
      };
    } catch (error) {
      console.error('Error in completeDraftOrder mutation:', error);
      throw new Error(`Failed to complete draft order: ${error.response?.data?.message || error.message}`);
    }
  }
  
  
}
