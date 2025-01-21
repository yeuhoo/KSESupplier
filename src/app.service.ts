import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LineItemInput } from './dto/draft-order.input';
import { ConfigService } from '@nestjs/config';
import { ShippingAddressInput } from './dto/shipping-address.input';
import { MetafieldInput } from './dto/metafield.input';
import * as nodemailer from 'nodemailer';
import { DraftOrderTag } from './dto/draft-order-tag.model';
import { DraftOrder } from './draft-order.model';
import { title } from 'process';

@Injectable()
export class AppService {
  private readonly shopifyApiUrl: string;
  private readonly shopifyAccessToken: string;
  private readonly tags: DraftOrderTag[] = [];

  constructor(private readonly configService: ConfigService) {
    this.shopifyApiUrl = this.configService.get<string>('SHOPIFY_API_URL');
    this.shopifyAccessToken = this.configService.get<string>('SHOPIFY_ACCESS_TOKEN');
  }

  async createDraftOrderTag(draftOrderId: string, tag: string): Promise<boolean> {
    try {
        // Ensure the draftOrderId has the correct prefix
        const formattedId = draftOrderId.startsWith('gid://shopify/DraftOrder/')
            ? draftOrderId // Use as-is if already prefixed
            : `gid://shopify/DraftOrder/${draftOrderId}`; // Add prefix if missing

        // Construct REST API URL (Shopify REST API works with numeric IDs, so we clean the ID here)
        const cleanDraftOrderId = formattedId.split('/').pop(); // Extract numeric part of the ID
        const restApiUrl = `${process.env.SHOPIFY_REST_API_URL}/draft_orders/${cleanDraftOrderId}.json`;

        // Fetch the current tags
        const fetchResponse = await axios({
            url: restApiUrl,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
            },
        });

        const currentTags = fetchResponse.data.draft_order.tags
            ? fetchResponse.data.draft_order.tags.split(', ')
            : [];

        // Add the tag if it doesn't already exist
        if (!currentTags.includes(tag)) {
            currentTags.push(tag);
        }

        // Update the tags
        const updateResponse = await axios({
            url: restApiUrl,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
            },
            data: {
                draft_order: {
                    tags: currentTags.join(', '),
                },
            },
        });

        // Handle errors returned by Shopify
        if (updateResponse.data.errors) {
            console.error('Shopify API errors:', updateResponse.data.errors);
            throw new Error('Shopify API returned an error');
        }

        console.log('Draft order tags updated successfully:', updateResponse.data.draft_order.tags);
        return true;

    } catch (error) {
        console.error('Error updating draft order tags in Shopify:', error.response?.data || error.message);
        throw new Error('Failed to update draft order tags in Shopify.');
    }
}


async getDraftOrderTags(draftOrderId: string): Promise<DraftOrderTag[]> {
  try {
      // Ensure the draftOrderId has the correct prefix
      const formattedId = draftOrderId.startsWith('gid://shopify/DraftOrder/')
          ? draftOrderId // Use as-is if already prefixed
          : `gid://shopify/DraftOrder/${draftOrderId}`; // Add prefix if missing

      // Extract numeric ID for Shopify REST API
      const cleanDraftOrderId = formattedId.split('/').pop(); // Extract numeric part of the ID

      // Construct GraphQL query with cleaned ID
      const graphqlQuery = {
          query: `
              query getDraftOrder($id: ID!) {
                  draftOrder(id: $id) {
                      id
                      tags
                  }
              }
          `,
          variables: { id: formattedId }, // Pass the formatted ID
      };

      // Make the GraphQL API request
      const response = await axios({
          url: this.shopifyApiUrl,
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': this.shopifyAccessToken,
          },
          data: graphqlQuery,
      });

      // Extract tags or return an empty array
      const tags = response.data.data.draftOrder?.tags || [];
      return tags.map((tag: string) => ({
          id: cleanDraftOrderId,
          draftOrderId: formattedId,
          tag,
      }));
  } catch (error) {
      console.error('Error retrieving draft order tags from Shopify:', error.message);
      throw new Error('Failed to retrieve draft order tags from Shopify.');
  }
}


  async updateDraftOrderTag(draftOrderId: string, newTag: string): Promise<DraftOrderTag> {
    try {
        // Get current tags
        const currentTags = await this.getDraftOrderTags(draftOrderId);

        // Update tag list with new tag
        const updatedTags = currentTags.map(tag => (tag.tag === newTag ? tag : { ...tag, tag: newTag }));
        
        const response = await axios({
            url: this.shopifyApiUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': this.shopifyAccessToken,
            },
            data: {
                query: `
                    mutation updateDraftOrder($id: ID!, $tags: [String!]) {
                        draftOrderUpdate(id: $id, input: { tags: $tags }) {
                            draftOrder {
                                id
                                tags
                            }
                            userErrors {
                                field
                                message
                            }
                        }
                    }
                `,
                variables: {
                    id: `gid://shopify/DraftOrder/${draftOrderId}`,
                    tags: updatedTags.map(tag => tag.tag),
                },
            },
        });

        const draftOrder = response.data.data?.draftOrderUpdate?.draftOrder;
        if (!draftOrder) throw new Error('Failed to update tags in Shopify.');

        return { id: draftOrderId, draftOrderId, tag: newTag };
    } catch (error) {
        console.error('Error updating draft order tag in Shopify:', error.message);
        throw new Error('Failed to update draft order tag in Shopify.');
    }
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
                  addresses {
                    address1
                    address2
                    city
                    province
                    country
                    zip
                  }
                }
              }
            }
          }
        `,
      },
    });
  
    const customers = response.data.data.customers.edges.map(edge => ({
      ...edge.node,
      addresses: edge.node.addresses.map(address => ({
        address1: address.address1,
        address2: address.address2,
        city: address.city,
        province: address.province,
        country: address.country,
        zip: address.zip,
      }))
    }));
  
    return customers;
  }

  async getUserById(id: string) {
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
                    customer(id: "${id}") {
                        id
                        firstName
                        lastName
                        addresses {
                            address1
                            address2
                            city
                            province
                            country
                            zip
                        }
                    }
                }
            `,
        },
    });

    return response.data.data.customer;
  }
  
  async getProducts() {
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
            products(first: 10) {
              edges {
                node {
                  id
                  title
                  description
                  priceRange {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                    maxVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        `,
      },
    });
    
    return response.data.data.products.edges.map(edge => edge.node);
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
  metafields: MetafieldInput[],
  note: string,
  attributes: Record<string, any> = {}
) {
  try {
    const formattedCustomerId = customerId.startsWith('gid://shopify/Customer/')
      ? customerId
      : `gid://shopify/Customer/${customerId}`;

      const reformattedLineItems = lineItems.map(item => ({
        ...item,
        variantId: item.variantId.startsWith('gid://shopify/ProductVariant/')
            ? item.variantId
            : `gid://shopify/ProductVariant/${item.variantId}`,
        appliedDiscount: {
            value: item.originalUnitPrice, 
            valueType: "FIXED_AMOUNT", 
            description: "Custom pricing applied",
        },
    }));
    

    const mutation = `
        mutation {
            draftOrderCreate(input: {
                customerId: "${formattedCustomerId}",
                lineItems: [
                    ${reformattedLineItems.map(item => `
                        {
                            variantId: "${item.variantId}",
                            quantity: ${item.quantity},
                            appliedDiscount: {
                                value: ${item.originalUnitPrice / 100}, 
                                valueType: FIXED_AMOUNT, 
                                description: "Custom pricing applied"
                            },
                            title: "${item.title || ''}"
                        }
                    `).join(',')}
                ],
                note: "${note}",
                email: "prince.oncada@gmail.com",
                shippingAddress: {
                    address1: "${shippingAddress.address1}",
                    city: "${shippingAddress.city}",
                    province: "${shippingAddress.province}",
                    country: "${shippingAddress.country}",
                    zip: "${shippingAddress.zip}"
                },
                metafields: [
                    ${metafields.map(metafield => `
                        {
                            namespace: "${metafield.namespace}",
                            key: "${metafield.key}",
                            value: "${metafield.value}",
                            type: "${metafield.type}"
                        }
                    `).join(',')}
                ]
            }) {
                draftOrder {
                    id
                    createdAt
                    lineItems(first: 10) {
                        edges {
                            node {
                                title
                                quantity
                                price: originalUnitPriceSet {
                                    shopMoney {
                                        amount
                                        currencyCode
                                    }
                                }
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
    `;

    console.log('Mutation Payload:', mutation);

    const response = await axios({
      url: this.shopifyApiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.shopifyAccessToken,
      },
      data: { query: mutation },
    });

    console.log('Full Response:', response.data);

    const { draftOrderCreate } = response.data.data;

    if (draftOrderCreate.userErrors.length > 0) {
      throw new Error(draftOrderCreate.userErrors[0].message);
    }

    return draftOrderCreate.draftOrder;
  } catch (error) {
    if (error.response) {
      console.error('Error Response Data:', error.response.data);
    }
    console.error('Error creating draft order:', error.message);
    throw new Error('Failed to create draft order.');
  }
}


async getDraftOrders() {
  try {
    const response = await axios({
      url: this.shopifyApiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.shopifyAccessToken,
      },
      data: {
        query: `
          query getDraftOrders {
            draftOrders(first: 50) {
              edges {
                node {
                  id
                  name
                  invoiceUrl
                  createdAt
                  customer {
                    id
                    firstName
                    lastName
                    email
                  }
                  shippingAddress {
                    address1
                    city
                    province
                    company
                    country
                    zip
                  }
                  lineItems(first: 10) {
                    edges {
                      node {
                        title
                        quantity                     
                        variant {
                          id
                          price
                          title
                          metafields(first: 5) {
                            nodes {
                              key
                              value
                            }
                          }
                        }
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

    const draftOrders = response.data.data.draftOrders.edges.map((edge) => edge.node);

    return draftOrders.map((order) => ({
      id: order.id,
      name: order.name,
      invoiceUrl: order.invoiceUrl,
      createdAt: order.createdAt,
      customer: order.customer
        ? {
            id: order.customer.id,
            firstName: order.customer.firstName,
            lastName: order.customer.lastName,
            email: order.customer.email,
      }
    : null,
      shippingAddress: order.shippingAddress
        ? {
            address1: order.shippingAddress.address1,
            city: order.shippingAddress.city,
            province: order.shippingAddress.province,
            company: order.shippingAddress.company,
            country: order.shippingAddress.country,
            zip: order.shippingAddress.zip,
          }
        : null,
      lineItems: order.lineItems.edges.map((item) => ({
        title: item.node.title,
        quantity: item.node.quantity,
        variant:  item.node.variant ? {
          id: item.node.variant?.id,
          title: item.node.variant?.title,
          price: item.node.variant?.price,
          metafields: item.node.variant?.metafields?.nodes || [],
        } : null,
      })),
      metafields: order.metafields.edges.map((mf) => ({
        id: mf.node.id,
        namespace: mf.node.namespace,
        key: mf.node.key,
        value: mf.node.value,
      })),
    }));
  } catch (error) {
    console.error("Error fetching draft orders:", error.message);
    throw new Error("Failed to fetch draft orders.");
  }
}

async newGetDraftOrders(): Promise<DraftOrder[]> {
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
          query {
            draftOrders(first: 50) {
              edges {
                node {
                  id
                  name
                  createdAt
                  customer {
                    id
                  }
                  tags
                  shippingAddress {
                    address1
                    city
                    province
                    country
                    zip
                  }
                  lineItems(first: 10) {
                    edges {
                      node {
                        title
                        quantity
                        variant {
                          title
                          price
                          metafields(first: 5) {
                            nodes {
                              key
                              value
                            }
                          }
                        }
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

    // Debugging: Ensure draftOrders are correctly fetched
    console.log('Response from Shopify API:', JSON.stringify(response.data, null, 2));

    if (!response.data.data?.draftOrders?.edges) {
      throw new Error('Draft orders not found in the API response.');
    }

    // Map response data to your DraftOrder format
    return response.data.data.draftOrders.edges.map((edge) => {
      const order = edge.node;
      return {
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        customer: order.customer ? { id: order.customer.id } : null,
        tags: order.tags || [], // Ensure tags is an array
        shippingAddress: order.shippingAddress
          ? {
              address1: order.shippingAddress.address1,
              city: order.shippingAddress.city,
              province: order.shippingAddress.province,
              country: order.shippingAddress.country,
              zip: order.shippingAddress.zip,
            }
          : null,
        lineItems: order.lineItems?.edges.map((lineItemEdge) => ({
          title: lineItemEdge.node.title,
          quantity: lineItemEdge.node.quantity,
          variant: lineItemEdge.node.variant
            ? {
                title: lineItemEdge.node.variant.title,
                price: lineItemEdge.node.variant.price,
                metafields: lineItemEdge.node.variant.metafields?.nodes || [],
              }
            : null,
        })) || [],
      };
    });
  } catch (error) {
    console.error('Error fetching draft orders:', error.message || error);
    throw new Error('Failed to fetch draft orders.');
  }
}




async fetchData(query: string): Promise<any> {
  try {
    const response = await axios({
      url: this.shopifyApiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.shopifyAccessToken,
      },
      data: { query },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    throw new Error('Failed to fetch data.');
  }
}

  async getDraftOrderById(id: string): Promise<DraftOrder> {
    try {
        const formattedId = id.startsWith('gid://shopify/DraftOrder/')
            ? id
            : `gid://shopify/DraftOrder/${id}`;

        console.log('Formatted Draft Order ID:', formattedId);

        const response = await axios({
            url: this.shopifyApiUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': this.shopifyAccessToken,
            },
            data: {
                query: `
                    query getDraftOrder($id: ID!) {
                        draftOrder(id: $id) {
                            id
                            invoiceUrl
                            createdAt
                            shippingAddress {
                                address1
                                city
                                province
                                country
                                zip
                            }
                            lineItems(first: 10) {
                                edges {
                                    node {
                                        title
                                        quantity
                                        variant {
                                            title
                                            price
                                            metafields(first: 5) {
                                                nodes {
                                                    key
                                                    value
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                `,
                variables: { id: formattedId },
            },
        });

        const draftOrder = response.data.data.draftOrder;

        if (!draftOrder) {
            throw new Error(`Draft order with ID ${id} not found.`);
        }

        return {
            id: draftOrder.id,
            createdAt: draftOrder.createdAt,
            shippingAddress: draftOrder.shippingAddress,
            lineItems: draftOrder.lineItems.edges.map((edge) => ({
                title: edge.node.title,
                quantity: edge.node.quantity,
                variant: {
                    title: edge.node.variant?.title,
                    price: edge.node.variant?.price,
                    metafields: edge.node.variant?.metafields?.nodes || [],
                },
            })),
        };
    } catch (error) {
        console.error('Error fetching draft order:', error.response?.data || error.message);
        throw new Error('Failed to fetch draft order.');
    }
}

  async calculateDraftOrder(draftOrderInput) {
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
                    mutation CalculateDraftOrder($input: DraftOrderInput!) {
                        draftOrderCalculate(input: $input) {
                            calculatedDraftOrder {
                                lineItems {
                                    title
                                    quantity
                                    discountedTotalSet {
                                        shopMoney {
                                            amount
                                            currencyCode
                                        }
                                    }
                                }
                                totalPriceSet {
                                    shopMoney {
                                        amount
                                        currencyCode
                                    }
                                }
                                totalTaxSet {
                                    shopMoney {
                                        amount
                                        currencyCode
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
                variables: {
                    input: draftOrderInput
                },
            },
        });

        const data = response.data.data.draftOrderCalculate.calculatedDraftOrder;

        if (response.data.data.draftOrderCalculate.userErrors.length > 0) {
            console.error('User Errors:', response.data.data.draftOrderCalculate.userErrors);
            throw new Error(response.data.data.draftOrderCalculate.userErrors[0].message);
        }

        return data.lineItems.map(item => ({
            title: item.title,
            quantity: item.quantity,
            price: item.discountedTotalSet.shopMoney.amount,
            currency: item.discountedTotalSet.shopMoney.currencyCode,
        }));
    } catch (error) {
        console.error('Error in calculating draft order:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
        throw new Error('Failed to calculate draft order.');
    }
}

  async calculateDraftOrderById(draftOrderId: string) {
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
              draftOrderCalculate(id: "gid://shopify/DraftOrder/${draftOrderId}") {
                calculatedDraftOrder {
                  lineItems {
                    title
                    quantity
                    discountedTotalSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalTaxSet {
                    shopMoney {
                      amount
                      currencyCode
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

      const data = response.data.data.draftOrderCalculate.calculatedDraftOrder;

      if (response.data.data.draftOrderCalculate.userErrors.length > 0) {
        console.error('User Errors:', response.data.data.draftOrderCalculate.userErrors);
        throw new Error(response.data.data.draftOrderCalculate.userErrors[0].message);
      }

      return data;
    } catch (error) {
      console.error('Error in calculating draft order:', error.message);
      if (error.response) {
        console.error('Response Data:', error.response.data);
      }
      throw new Error('Failed to calculate draft order.');
    }
  }

  async checkForShippingFee(draftOrderId: string): Promise<number> {
    try {
      // Ensure the ID is in the correct format
      const formattedId = draftOrderId.startsWith('gid://shopify/DraftOrder/')
        ? draftOrderId
        : `gid://shopify/DraftOrder/${draftOrderId}`;
  
      const response = await axios({
        url: this.shopifyApiUrl, // Your Shopify API endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: {
          query: `
            query {
              draftOrder(id: "${formattedId}") {
                id
                shippingLine {
                  title
                  price
                }
              }
            }
          `,
        },
      });
  
      const draftOrder = response.data.data.draftOrder;
  
      if (draftOrder && draftOrder.shippingLine && draftOrder.shippingLine.price) {
        return parseFloat(draftOrder.shippingLine.price);
      } else {
        return 0; // No shipping fee present
      }
    } catch (error) {
      if (error.response) {
        console.error('Error Status:', error.response.status);
        console.error('Error Data:', error.response.data);
      }
      console.error('Error checking for shipping fee:', error.message);
      throw new Error('Failed to check for shipping fee.');
    }
  }
  

  async updateDraftOrderAddress(draftOrderId: string, shippingAddress: ShippingAddressInput) {
    // Ensure the draftOrderId has the correct format
    const formattedDraftOrderId = draftOrderId.startsWith('gid://shopify/DraftOrder/')
      ? draftOrderId // Use as-is if it's already prefixed
      : `gid://shopify/DraftOrder/${draftOrderId}`; // Add prefix if it's missing
  
    const mutation = `
      mutation {
        draftOrderUpdate(id: "${formattedDraftOrderId}", input: {
          shippingAddress: {
            address1: "${shippingAddress.address1}",
            city: "${shippingAddress.city}",
            province: "${shippingAddress.province}",
            company: "${shippingAddress.company}",
            country: "${shippingAddress.country}",
            zip: "${shippingAddress.zip}"
          }
        }) {
          draftOrder {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
  
    try {
      const response = await axios.post(
        this.shopifyApiUrl,
        { query: mutation },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.shopifyAccessToken,
          },
        }
      );
  
      const data = response.data;
      if (data.errors || data.data.draftOrderUpdate.userErrors.length > 0) {
        console.error(
          'Error updating draft order address:',
          data.errors || data.data.draftOrderUpdate.userErrors
        );
        throw new Error('Failed to update draft order address.');
      }
    } catch (error) {
      console.error('Error in updateDraftOrderAddress:', error.message);
      throw error;
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
    // Ensure the draft order ID has the correct prefix
    const formattedDraftOrderId = id.startsWith('gid://shopify/DraftOrder/')
      ? id // Use as-is if it's already prefixed
      : `gid://shopify/DraftOrder/${id}`; // Add prefix if it's missing

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
            id: formattedDraftOrderId, // Use the formatted ID here
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
      // Ensure the ID is formatted correctly
      const formattedId = id.startsWith('gid://shopify/DraftOrder/')
        ? id // Use as-is if already prefixed
        : `gid://shopify/DraftOrder/${id}`; // Add prefix if missing
  
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
            id: formattedId, // Use the validated/constructed ID
          },
        },
      });
  
      const { data } = response;
      if (data.errors) {
        console.error('Shopify API errors:', data.errors);
        throw new Error(data.errors[0]?.message || 'Unknown error from Shopify API');
      }
  
      const draftOrderComplete = data.data?.draftOrderComplete;
      if (draftOrderComplete.userErrors && draftOrderComplete.userErrors.length > 0) {
        throw new Error(draftOrderComplete.userErrors[0].message);
      }
  
      if (!draftOrderComplete || !draftOrderComplete.draftOrder) {
        throw new Error('Draft order completion failed.');
      }
  
      return draftOrderComplete.draftOrder;
  
    } catch (error) {
      console.error('Error completing draft order:', error.message);
      throw new Error('Failed to complete draft order.');
    }
  }
  
  async isDraftOrderCompleted(id: string): Promise<boolean> {
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
              draftOrder(id: "gid://shopify/DraftOrder/${id}") {
                id
                order {
                  id
                }
              }
            }
          `,
        },
      });

      const draftOrder = response.data.data.draftOrder;
      // If an associated order exists, the draft order is completed
      return draftOrder.order != null;
    } catch (error) {
      console.error('Error checking draft order completion status:', error);
      throw new Error('Failed to check draft order completion status.');
    }
  }
  
  async sendShippingRequestEmail(userId: string, draftOrderId: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or another email provider
      auth: {
        user: process.env.EMAIL_USER, // email account username
        pass: process.env.EMAIL_PASS, // email account password
      },
    });

    const numericDraftOrderId = draftOrderId.replace('gid://shopify/DraftOrder/', '');

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'it@hafstaff.com',
      subject: `Request Shipping Fee: ${numericDraftOrderId}`,
      text: `
        User ID: ${userId}
        Draft Order ID: ${numericDraftOrderId}
        It would be great if you click this link!
        https://admin.shopify.com/store/kse-suppliers/draft_orders/${numericDraftOrderId}
        
        User requests for shipping fee for this draft order.
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Shipping request email sent successfully.');
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send shipping request email.');
    }
  }

  async placeOrderEmail(userId: string, draftOrderId: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or another email provider
      auth: {
        user: process.env.EMAIL_USER, // email account username
        pass: process.env.EMAIL_PASS, // email account password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'it@hafstaff.com',
      subject: `Request Shipping Fee: ${draftOrderId}`,
      text: `
        User ID: ${userId}
        Draft Order ID: ${draftOrderId}
        It would be great if you click this link!
        https://admin.shopify.com/store/kse-suppliers/draft_orders/${draftOrderId}
        
        User requests for placing this draft order.
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Shipping request email sent successfully.');
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send shipping request email.');
    }
  }
}
