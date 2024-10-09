import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LineItemInput } from './dto/line-item.input';
import { ConfigService } from '@nestjs/config';
import { ShippingAddressInput } from './dto/shipping-address.input';
import { MetafieldInput } from './dto/metafield.input';

@Injectable()
export class AppService {
  private readonly shopifyApiUrl: string;
  private readonly shopifyAccessToken: string;

  constructor(private configService: ConfigService) {
    this.shopifyApiUrl = this.configService.get<string>('SHOPIFY_API_URL');
    this.shopifyAccessToken = this.configService.get<string>('SHOPIFY_ACCESS_TOKEN');
  }

  async getUsers() {
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
            customers(first: 10) {
              edges {
                node {
                  id
                  firstName
                  lastName
                  email
                }
              }
            }
          }
        `,
      },
    });
    const customers = response.data.data.customers.edges.map(edge => edge.node);
    return customers;
  }

  async getProducts() {
    const response = await axios({
      url: this.shopifyApiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token':  this.shopifyAccessToken,
      },
      data: {
        query: `
          {
            products(first: 10) {
              edges {
                node {
                  id
                  title
                  description
                }
              }
            }
          }
        `,
      },
    });

    const products = response.data.data.products.edges.map(edge => edge.node);
    return products;
  }

  async getProductDetails(productId: string) {
    const response = await axios({
      url: this.shopifyApiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.shopifyAccessToken,
      },
      data: {
        query: `
          query {
            product(id: "${productId}") {
              variants(first: 1) {
                edges {
                  node {
                    id
                    title
                  }
                }
              }
            }
          }
        `,
      },
    });
  
    const product = response.data.data.product;
  
    if (!product || !product.variants || product.variants.edges.length === 0) {
      throw new Error(`No variants found for product ID: ${productId}`);
    }
  
    const defaultVariantId = product.variants.edges[0].node.id;
    return { defaultVariantId };
  }
  
//DraftOrders ni prince
  async createDraftOrder(
    customerId: string,
    lineItems: LineItemInput[],
    shippingAddress: ShippingAddressInput,
    metafields: MetafieldInput[]
  ) {
    try {
      const response = await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,  
        },
        data: {
          query: `
            mutation {
              draftOrderCreate(input: {
                customerId: "gid://shopify/Customer/${customerId}",  
                lineItems: [
                  ${lineItems
                    .map(
                      item => `
                    {
                      variantId: "${item.variantId}",
                      quantity: ${item.quantity}
                    }`
                    )
                    .join(',')}
                ],
                note: "Test draft order",
                email: "test.user@shopify.com",
                shippingAddress: {
                  address1: "${shippingAddress.address1}",
                  city: "${shippingAddress.city}",
                  province: "${shippingAddress.province}",
                  country: "${shippingAddress.country}",
                  zip: "${shippingAddress.zip}"
                },
                metafields: [
                  ${metafields
                    .map(
                      metafield => `
                    {
                      namespace: "${metafield.namespace}",
                      key: "${metafield.key}",
                      value: "${metafield.value}",
                      type: "${metafield.type}"
                    }`
                    )
                    .join(',')}
                ]
              }) {
                draftOrder {
                  id
                  invoiceUrl
                  lineItems(first: 10) {
                    edges {
                      node {
                        title
                        quantity
                      }
                    }
                  }
                  metafields(first: 10) {
                    edges {
                      node {
                        id
                        namespace
                        key
                        value
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
        },
      });

      const { draftOrderCreate } = response.data.data;

      if (draftOrderCreate.userErrors.length > 0) {
        throw new Error(draftOrderCreate.userErrors[0].message);
      }

      return draftOrderCreate.draftOrder;
    } catch (error) {
      if (error.response) {
        console.error('Error Status:', error.response.status);
        console.error('Error Data:', error.response.data);
      }
      console.error('Error creating draft order:', error.message);
      throw new Error('Failed to create draft order.');
    }
  }

  async getDraftOrders() {
    try {
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
              draftOrders(first: 10) {
                edges {
                  node {
                    id
                    invoiceUrl
                    lineItems(first: 10) {
                      edges {
                        node {
                          title
                          quantity
                        }
                      }
                    }
                    metafields(first: 10) {
                      edges {
                        node {
                          id
                          namespace
                          key
                          value
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
        },
      });

      return response.data.data.draftOrders.edges.map((edge) => ({
        id: edge.node.id,
        invoiceUrl: edge.node.invoiceUrl,
        lineItems: edge.node.lineItems.edges.map((item) => item.node),
        metafields: edge.node.metafields.edges.map((mf) => mf.node),
      }));
    } catch (error) {
      console.error('Error fetching draft orders:', error.message);
      throw new Error('Failed to fetch draft orders.');
    }
  }
  
  async updateDraftOrder(id: string, customerId: string, lineItems: LineItemInput[], metafields: any[], shippingAddress: ShippingAddressInput) {
    try {
      const lineItemsWithVariants = lineItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));
  
      const response = await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,  
        },
        data: {
          query: `
            mutation updateDraftOrder($id: ID!, $input: DraftOrderInput!) {
              draftOrderUpdate(id: $id, input: $input) {
                draftOrder {
                  id
                  invoiceUrl
                  lineItems(first: 10) {
                    edges {
                      node {
                        title
                        quantity
                      }
                    }
                  }
                  metafields(first: 10) {
                    edges {
                      node {
                        id
                        namespace
                        key
                        value
                      }
                    }
                  }
                  shippingAddress {
                    address1
                    city
                    province
                    country
                    zip
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            id: `gid://shopify/DraftOrder/${id}`,
            input: {
              customerId: `gid://shopify/Customer/${customerId}`,
              lineItems: lineItemsWithVariants,
              metafields: metafields,
              shippingAddress: {
                address1: shippingAddress.address1,
                city: shippingAddress.city,
                province: shippingAddress.province,
                country: shippingAddress.country,
                zip: shippingAddress.zip,
              },
            },
          },
        },
      });
  
      const { draftOrderUpdate } = response.data.data;
  
      if (draftOrderUpdate.userErrors.length > 0) {
        throw new Error(draftOrderUpdate.userErrors[0].message);
      }
  
      return draftOrderUpdate.draftOrder;
    } catch (error) {
      if (error.response) {
        console.error('Error Status:', error.response.status);
        console.error('Error Data:', error.response.data);
      }
      throw new Error('Failed to update draft order.');
    }
  }
  
  async deleteDraftOrder(id: string) {
    try {
      const response = await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: {
          query: `
            mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
              draftOrderDelete(input: $input) {
                deletedId
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              id: `gid://shopify/DraftOrder/${id}`,
            },
          },
        },
      });
  
      const { draftOrderDelete } = response.data.data;
  
      if (draftOrderDelete.userErrors.length > 0) {
        throw new Error(draftOrderDelete.userErrors[0].message);
      }
  
      return draftOrderDelete.deletedId;
    } catch (error) {
      if (error.response) {
        console.error('Error Status:', error.response.status);
        console.error('Error Data:', error.response.data);
      }
      console.error('Error deleting draft order:', error.message);
      throw new Error('Failed to delete draft order.');
    }
  }
  
  async completeDraftOrder(id: string) {
    try {
      const response = await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: {
          query: `
            mutation draftOrderComplete($id: ID!) {
              draftOrderComplete(id: $id) {
                draftOrder {
                  id
                  order {
                    id
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            id: `gid://shopify/DraftOrder/${id}`,
          },
        },
      });
  
      const { draftOrderComplete } = response.data.data;
  
      if (draftOrderComplete.userErrors.length > 0) {
        throw new Error(draftOrderComplete.userErrors[0].message);
      }
  
      return draftOrderComplete.draftOrder;
    } catch (error) {
      if (error.response) {
        console.error('Error Status:', error.response.status);
        console.error('Error Data:', error.response.data);
      }
      console.error('Error completing draft order:', error.message);
      throw new Error('Failed to complete draft order.');
    }
  }
  
}
