import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LineItemInput } from './dto/draft-order.input';
import { ConfigService } from '@nestjs/config';
import { ShippingAddressInput } from './dto/shipping-address.input';
import { MetafieldInput } from './dto/metafield.input';
import * as nodemailer from 'nodemailer';
import { DraftOrderTag } from './dto/draft-order-tag.model';
import { DraftOrder } from './draft-order.model';

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
        const restApiUrl = `${process.env.SHOPIFY_REST_API_URL}/draft_orders/${draftOrderId}.json`;

        const fetchResponse = await axios({
            url: restApiUrl,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
            },
        });

        const currentTags = fetchResponse.data.draft_order.tags ? fetchResponse.data.draft_order.tags.split(', ') : [];

        if (!currentTags.includes(tag)) {
            currentTags.push(tag);
        }

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
                            tags
                        }
                    }
                `,
                variables: { id: `gid://shopify/DraftOrder/${draftOrderId}` },
            },
        });

        const tags = response.data.data.draftOrder?.tags || [];
        return tags.map((tag: string) => ({ id: draftOrderId, draftOrderId, tag }));
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
              customerId: "${customerId}",
              lineItems: [
                ${lineItems
                  .map(
                    item => `
                  {
                    variantId: "${item.variantId}",
                    quantity: ${item.quantity},
                    originalUnitPrice: ${item.originalUnitPrice || 0},
                    title: "${item.title || ''}"
                  }`
                  )
                  .join(',')}
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
      },
    });

    console.log('Full Response:', response.data);
    const { draftOrderCreate } = response.data.data;

    if (draftOrderCreate.userErrors.length > 0) {
      throw new Error(draftOrderCreate.userErrors[0].message);
    }

    const draftOrder = draftOrderCreate.draftOrder;

    return {
      id: draftOrder.id,
      createdAt: draftOrder.createdAt,
      lineItems: draftOrder.lineItems.edges.map(edge => ({
        title: edge.node.title,
        quantity: edge.node.quantity,
        price: edge.node.price.shopMoney.amount,
        currency: edge.node.price.shopMoney.currencyCode,
      })),
      metafields: draftOrder.metafields.edges.map(edge => ({
        id: edge.node.id,
        namespace: edge.node.namespace,
        key: edge.node.key,
        value: edge.node.value,
      })),
      shippingAddress: draftOrder.shippingAddress,
    };
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
                            createdAt
                            customer {
                            id
                            }
                            lineItems(first: 10) {
                                edges {
                                    node {
                                    title
                                    quantity
                                    variant {
                                        price
                                    }
                                    variantTitle
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
    console.log(response.data.data.draftOrders.edges[0].node.lineItems.edges[0].node.variantTitle);
      return response.data.data.draftOrders.edges.map((edge) => ({
        id: edge.node.id,
        invoiceUrl: edge.node.invoiceUrl,
        createdAt: edge.node.createdAt,
        customerId: edge.node.customer?.id,
        lineItems: edge.node.lineItems.edges.map((item) => ({
          title: item.node.title,
          quantity: item.node.quantity,
          price: item.node.variant?.price,
          variant_title: item.node.variantTitle,
        })),
        metafields: edge.node.metafields.edges.map((mf) => mf.node),
      }));
    } catch (error) {
      console.error('Error fetching draft orders:', error.message);
      throw new Error('Failed to fetch draft orders.');
    }
  }

  async getDraftOrderById(id: string): Promise<DraftOrder> {
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
                    query($id: ID!) {
                        draftOrder(id: $id) {
                            id
                            shippingAddress {
                                address1
                                city
                                province
                                country
                                zip
                            }
                        }
                    }
                `,
                variables: {
                    id: `gid://shopify/DraftOrder/${id}`,
                },
            },
        });

        const draftOrder = response.data.data.draftOrder;
        if (!draftOrder) {
            throw new Error(`Draft order with ID ${id} not found.`);
        }

        return draftOrder;
    } catch (error) {
        console.error('Error fetching draft order:', error.message);
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

  async checkForShippingFee(draftOrderId: string) {
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
                        draftOrder(id: "gid://shopify/DraftOrder/${draftOrderId}") {
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
            return 0; // No shipping fee
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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'it@hafstaff.com',
      subject: `Request Shipping Fee: ${draftOrderId}`,
      text: `
        User ID: ${userId}
        Draft Order ID: ${draftOrderId}
        It would be great if you click this link!
        https://admin.shopify.com/store/kse-suppliers/draft_orders/${draftOrderId}
        
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
}