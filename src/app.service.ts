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
  private readonly shopifyRestUrl2: string;
  private readonly shopifyAccessToken: string;
  private readonly tags: DraftOrderTag[] = [];

  constructor(private readonly configService: ConfigService) {
    this.shopifyApiUrl = this.configService.get<string>('SHOPIFY_API_URL');
    this.shopifyAccessToken = this.configService.get<string>('SHOPIFY_ACCESS_TOKEN');
    this.shopifyRestUrl2 = this.configService.get<string>('SHOPIFY_REST_API_URL_2');
  }
  escapeGraphQLString(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, '\\\\')   // escape backslashes
    .replace(/"/g, '\\"')     // escape double quotes
    .replace(/\n/g, '\\n')    // escape newlines
    .replace(/\r/g, '')       // remove carriage returns if any
    .trim();
  }

  async getCompanyPriceLevel() {
    try {
      return await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: {query:
          `
            query {
              shop {
                metafield(namespace: "pricing", key: "price_level_per_company") {
                  value
                }
              }
            }
          `
        },
      }).then(response => {
        return JSON.parse(response.data.data.shop.metafield.value || '{}');
      })
    } catch (error) {
      console.error('Error fetching company price level:', error.message);
      throw new Error('Failed to fetch company price level.');
    }
  }
async addNotifyStaffMetafield(draftOrderId: string): Promise<boolean> {
  const store = this.configService.get<string>('SHOPIFY_STORE');
  const token = this.configService.get<string>('SHOPIFY_ADMIN_TOKEN');
  const url = `https://${store}/admin/api/2024-01/draft_orders/${draftOrderId}/metafields.json`;

  try {
    await axios.post(
      url,
      {
        metafield: {
          namespace: "custom",
          key: "notify_staff",
          value: "true",
          type: "single_line_text_field"
        }
      },
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json"
        }
      }
    );
    return true;
  } catch (error) {
    console.error("Metafield Error:", error.response?.data || error);
    return false;
  }
}
async getDraftOrderDetails(draftOrderId: string): Promise<any> {
  const numericId = draftOrderId.replace('gid://shopify/DraftOrder/', '');

  const response = await axios.get(
    `${this.shopifyRestUrl2}/admin/api/2024-01/draft_orders/${numericId}.json`,
    {
      headers: {
        'X-Shopify-Access-Token': this.shopifyAccessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    }
  );

  return response.data.draft_order;
}



async updateDraftOrderNote(draftOrderId: string, jobCode: string): Promise<boolean> {
  const draftOrderIdFormatted = draftOrderId.startsWith('gid://shopify/DraftOrder/')
    ? draftOrderId
    : `gid://shopify/DraftOrder/${draftOrderId}`;

  const mutation = `
    mutation draftOrderUpdate($input: DraftOrderInput!) {
      draftOrderUpdate(input: $input) {
        draftOrder {
          id
          note
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      id: draftOrderIdFormatted,
      note: `PO: ${jobCode}`,
    },
  };

  try {
    const response = await axios({
      url: this.shopifyApiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.shopifyAccessToken,
      },
      data: {
        query: mutation,
        variables,
      },
    });


    console.log('FULL RESULT:', JSON.stringify(response.data, null, 2));

    const draftOrderUpdate = response.data?.data?.draftOrderUpdate;

    if (!draftOrderUpdate) {
      console.error('draftOrderUpdate is missing in response:', JSON.stringify(response.data, null, 2));
      throw new Error('draftOrderUpdate field missing in Shopify response.');
    }

    const errors = draftOrderUpdate.userErrors;
    if (errors && errors.length > 0) {
      console.error('GraphQL User Errors:', errors);
      throw new Error(errors.map(e => e.message).join(', '));
    }

    console.log('Draft order note updated successfully:', draftOrderUpdate.draftOrder);
    return true;
  } catch (error) {
    console.error('Error updating draft order note:', error.message);
    throw new Error('Failed to update draft order note.');
  }
}




  async deleteCompany(company: string) {
    try {
      let mapping = {};
      let shopId = null;
      await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: {query:
          `
            query {
              shop {
                id
                metafield(namespace: "pricing", key: "price_level_per_company") {
                  id
                  value
                }
              }
            }
          `
        },
      }).then(response => {
        shopId = response.data.data.shop.id; // Get Shop ID for mutation

        // Get existing company-priceLevel pairings and replace. Add new company and priceLevel if not existing.
        const metafield = response.data.data.shop.metafield;
        if (metafield && metafield.value) {
          mapping = JSON.parse(metafield.value);
        }
        if (company in mapping) {
          delete mapping[company];
        }
      }).catch(error => {
        console.error('Error fetching shop metafield:', error.message);
      });

      const mutation = `
        mutation {
          metafieldsSet(metafields: [{
            namespace: "pricing",
            key: "price_level_per_company",
            value: "${this.escapeGraphQLString(JSON.stringify(mapping))}",
            type: "json",
            ownerId: "${shopId}"
          }]) {
            metafields {
              id
              namespace
              key
              value
            }
          }
        }
      `;

      return await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: { query: mutation },
      }).then(response => {
        console.log('chek response for setCompanyPriceLevel:', response.data);
        return response.data.data.metafieldsSet.metafields;
      });
    } catch (error) {
      console.error('Error deleting company:', error.message);
      throw new Error('Failed to delete company.');
    }
  }

  async setCompanyPriceLevel(
    company: string,
    priceLevel?: string
  ) {
    try {
      priceLevel = priceLevel || ""; // Default to no tag if not provided

      let mapping = {};
      let shopId = null;

      // Check if metafield exists and get Shop ID
      await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: {query:
          `
            query {
              shop {
                id
                metafield(namespace: "pricing", key: "price_level_per_company") {
                  id
                  value
                }
              }
            }
          `
        },
      }).then(response => {
        shopId = response.data.data.shop.id; // Get Shop ID for mutation

        // Get existing company-priceLevel pairings and replace. Add new company and priceLevel if not existing.
        const metafield = response.data.data.shop.metafield;
        if (metafield && metafield.value) {
          mapping = JSON.parse(metafield.value);
        }
        mapping[company] = priceLevel;
      }).catch(error => {
        console.error('Error fetching shop metafield:', error.message);
      });

      const mutation = `
        mutation {
          metafieldsSet(metafields: [{
            namespace: "pricing",
            key: "price_level_per_company",
            value: "${this.escapeGraphQLString(JSON.stringify(mapping))}",
            type: "json",
            ownerId: "${shopId}"
          }]) {
            metafields {
              id
              namespace
              key
              value
            }
          }
        }
      `;

      return await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: { query: mutation },
      }).then(response => {
        console.log('chek response for setCompanyPriceLevel:', response.data);
        return response.data.data.metafieldsSet.metafields;
      });
    } catch (error) {
      console.error('Error setting company price level:', error.message);
      throw new Error('Failed to set company price level.');
    }
  }

  // Edit customer company name in default address
  async updateCustomerCompany(id: string, company: string) { // chek new line
    try {
      const customerIdFormatted = id.startsWith('gid://shopify/Customer/')
        ? id // Use as-is if already prefixed
        : `gid://shopify/Customer/${id}`; // Add prefix if missing

      const priceLevels = ["price1", "price2", "price6", "price7", "price8", "test"];

      // Get default Address ID and existing customer tags
      const data = await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: {
          query: `
            query {
              customer(id: "${customerIdFormatted}") {
                tags
                defaultAddress {
                  id
                }
              }
            }
          `,
        },
      }).then(response => {
        return {"defaultAddress" : response.data.data.customer.defaultAddress.id, "tags": response.data.data.customer.tags};
      })

      const currentTags = data.tags || [];
      const filteredTags = currentTags.filter(tag => !priceLevels.includes(tag.trim())); // Keep non-price level tags
      
      // Get price level for company from getCompanyPriceLevel
      const companyPriceLevels = await this.getCompanyPriceLevel();
      for (const [companyName, priceLevel] of Object.entries(companyPriceLevels)) {
        if (companyName === company) {
          if (priceLevel && !filteredTags.includes(priceLevel)) {
            filteredTags.push(priceLevel);
          }
        }
      }
      // if (!filteredTags.includes(priceLevel)) {
      //   filteredTags.push(priceLevel);
      // }
      // tags: [${filteredTags.map(tag => `"${tag.trim()}"`).join(', ')}],

      const mutation = `
        mutation {
          customerUpdate(input: {
            id: "${id}",
            tags: [${filteredTags.map(tag => `"${tag.trim()}"`).join(', ')}],
            addresses: {
              id: "${data.defaultAddress}",
              company: "${company}"
            },
          }) {
            customer {
              id
              firstName
              lastName
              tags
              defaultAddress {
                company
              }
            }
          }
        }
      `;

      const customerCompany = await axios({
        url: this.shopifyApiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
        },
        data: { query: mutation },
      }).then(res => {
        return {
          id: res.data.data.customerUpdate.customer.id,
          firstName: res.data.data.customerUpdate.customer.firstName,
          lastName: res.data.data.customerUpdate.customer.lastName,
          company: res.data.data.customerUpdate.customer.defaultAddress.company,
          priceLevel: filteredTags.find(tag => priceLevels.includes(tag.trim())) || null
        }
      });
      return customerCompany;
    } catch (error) {
      console.error('Error editing customer company:', error.message);
      throw new Error('Failed to edit customer company.' + error.message);
    }
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

  async getCustomersWithCompanies(): Promise<{ id: string; firstName?: string; lastName?: string; company: string }[]> {
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
            customers(first: 100) {
              edges {
                node {
                  id
                  firstName
                  lastName
                  defaultAddress {
                    company
                  }
                }
              }
            }
          }
        `,
      },
    })
    .then(response => {
      console.log('chek Raw Customers Data:', response);
      const rawCustomers = response.data.data.customers.edges;
      return rawCustomers.map(({ node }) => ({
        id: node.id,
        firstName: node.firstName?.trim() || "N/A",
        lastName: node.lastName?.trim() || "N/A",
        company: node.defaultAddress?.company?.trim() || "N/A",
      }));
    })
    .catch(error => {
      console.log('Error fetching customers:', error.message);
      return [{
        id: "n/a",
        first_name: "n/a",
        last_name: "n/a",
        company: "n/a",
      }];
    });
    
    return response;
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
            customers(first: 100) {
              edges {
                node {
                  id
                  firstName
                  lastName
                  email
                  addresses {
                    address1
                    address2
                    company
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
  email: string,
  attributes: Record<string, any> = {}
) {
  try {
    const formattedCustomerId = customerId.startsWith('gid://shopify/Customer/')
      ? customerId
      : `gid://shopify/Customer/${customerId}`;

    // 🟢 Extract email from note
    let extractedEmail = "fatima@ksesuppliers.com";
    const emailMatch = note.match(/email:\s*([^\s,]+)/i);
    if (emailMatch) {
      extractedEmail = emailMatch[1].trim();
    }
    console.log("Extracted Email:", extractedEmail);

    // Escape values
    const safeNote = this.escapeGraphQLString(note);
    const safeEmail = this.escapeGraphQLString(extractedEmail);

    const reformattedLineItems = lineItems.map((item) => {
      const hasDiscount =
        item.originalUnitPrice &&
        item.originalUnitPrice > 0 &&
        item.originalUnitPrice !== item.originalPrice;

      return {
        ...item,
        variantId: item.variantId.startsWith('gid://shopify/ProductVariant/')
          ? item.variantId
          : `gid://shopify/ProductVariant/${item.variantId}`,
        ...(hasDiscount
          ? {
              appliedDiscount: {
                value: ((item.originalPrice - item.originalUnitPrice) / 100).toFixed(2),
                valueType: "FIXED_AMOUNT",
                description: "Custom pricing applied",
              },
            }
          : {}),
      };
    });

    const mutation = `
      mutation {
        draftOrderCreate(input: {
          customerId: "${formattedCustomerId}",
          email: "${safeEmail}",
          note: "${safeNote}",
          lineItems: [
            ${reformattedLineItems.map((item) => `
              {
                variantId: "${item.variantId}",
                quantity: ${item.quantity},
                ${item.appliedDiscount ? `
                  appliedDiscount: {
                    value: ${item.appliedDiscount.value},
                    valueType: ${item.appliedDiscount.valueType},
                    description: "${this.escapeGraphQLString(item.appliedDiscount.description)}"
                  }` : ''}
                title: "${this.escapeGraphQLString(item.title || '')}"
              }
            `).join(",")}
          ],
          shippingAddress: {
            address1: "${this.escapeGraphQLString(shippingAddress.address1)}",
            city: "${this.escapeGraphQLString(shippingAddress.city)}",
            province: "${this.escapeGraphQLString(shippingAddress.province)}",
            country: "${this.escapeGraphQLString(shippingAddress.country)}",
            zip: "${this.escapeGraphQLString(shippingAddress.zip)}"
          },
          metafields: [
            ${metafields.map((metafield) => `
              {
                namespace: "${this.escapeGraphQLString(metafield.namespace)}",
                key: "${this.escapeGraphQLString(metafield.key)}",
                value: "${this.escapeGraphQLString(metafield.value)}",
                type: "${this.escapeGraphQLString(metafield.type)}"
              }
            `).join(",")}
          ]
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

    const response = await axios({
      url: this.shopifyApiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.shopifyAccessToken,
      },
      data: { query: mutation },
    });

    const { draftOrderCreate } = response.data.data;

    if (draftOrderCreate.userErrors.length > 0) {
      throw new Error(draftOrderCreate.userErrors[0].message);
    }

    return draftOrderCreate.draftOrder;
  } catch (error) {
    if (error.response) {
      console.error("Error Response Data:", error.response.data);
    }
    console.error("Error creating draft order:", error.message);
    throw new Error("Failed to create draft order.");
  }
}


async sendDraftOrderInvoice(draftOrderId) {
  try {
    const formattedDraftOrderId = draftOrderId.startsWith('gid://shopify/DraftOrder/')
      ? draftOrderId
      : `gid://shopify/DraftOrder/${draftOrderId}`;

    const mutation = `
      mutation {
        draftOrderInvoiceSend(id: "${formattedDraftOrderId}") {
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

    const response = await axios({
      url: this.shopifyApiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.shopifyAccessToken,
      },
      data: { query: mutation },
    });

    console.log("Invoice Send Response:", response.data);

    const result = response.data.data.draftOrderInvoiceSend;

    if (result.userErrors.length > 0) {
      throw new Error(result.userErrors[0].message);
    }

    return true;
  } catch (error) {
    console.error("Error sending draft order invoice:", error.message);
    throw new Error("Failed to send draft order invoice.");
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
                        appliedDiscount {
                          value
                          valueType
                        }                 
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
        appliedDiscount: item.node.appliedDiscount
        ? {
            value: item.node.appliedDiscount.value,
            valueType: item.node.appliedDiscount.valueType,
          }
        : null,
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
            draftOrders(first: 100) {
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
                        appliedDiscount {
                          value
                          valueType
                        }
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
          appliedDiscount: lineItemEdge.node.appliedDiscount
          ? {
              value: lineItemEdge.node.appliedDiscount.value,
              valueType: lineItemEdge.node.appliedDiscount.valueType,
            }
          : null,
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
                                        appliedDiscount {
                                          value
                                          valueType
                                        }
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
                appliedDiscount: edge.node.appliedDiscount
                ? {
                    value: edge.node.appliedDiscount.value,
                    valueType: edge.node.appliedDiscount.valueType,
                  }
                : null,
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
  

  async updateDraftOrderAddress(draftOrderId: string, shippingAddress: ShippingAddressInput, email:string) {
    // Ensure the draftOrderId has the correct format
    const formattedDraftOrderId = draftOrderId.startsWith('gid://shopify/DraftOrder/')
      ? draftOrderId // Use as-is if it's already prefixed
      : `gid://shopify/DraftOrder/${draftOrderId}`; // Add prefix if it's missing
  
    const mutation = `
      mutation {
        draftOrderUpdate(id: "${formattedDraftOrderId}", input: {
          email: "${email}",
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
              firstName: shippingAddress.firstName || "",
              lastName: shippingAddress.lastName || "",
              company: shippingAddress.company || ""
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
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const numericDraftOrderId = draftOrderId.replace('gid://shopify/DraftOrder/', '');

  // Fetch order data from Shopify
  const draftOrder = await this.getDraftOrderDetails(draftOrderId);

  const customer = draftOrder?.customer || {};
  const lineItems = draftOrder?.line_items || [];
  const tags = draftOrder?.tags || "";
  const poTag = tags.split(',').find(tag => tag.includes('PO:')) || '';

  // Build product table
  const productListHTML = lineItems.map(item => {
    const title = item.title || '';
    const quantity = item.quantity || 1;
    const price = item.price || '0.00';
    const image = item.variant?.image?.src || ''; // Optional, depending on API

    return `
      <tr>
        <td><img src="${image}" alt="${title}" width="60" style="border-radius: 4px;" /></td>
        <td>${title}</td>
        <td>x${quantity}</td>
        <td>${price} ${draftOrder.currency || ''}</td>
      </tr>
    `;
  }).join("");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'orders@ksesuppliers.com',
    subject: `Shipping Request - Order ${draftOrder.name || numericDraftOrderId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9f9f9;">
        <h2 style="color: #951828;">Shipping Fee Request</h2>

        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Customer:</strong> ${customer.first_name || ''} ${customer.last_name || ''} (${customer.email || ''})</p>
        <p><strong>Company:</strong> ${customer.default_address?.company || 'N/A'}</p>
        <p><strong>PO:</strong> ${poTag || 'None'}</p>

        <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
          <thead style="background-color: #eee;">
            <tr>
              <th>Image</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>${productListHTML}</tbody>
        </table>

        <p style="margin-top: 20px;">
          <a href="https://admin.shopify.com/store/kse-suppliers/draft_orders/${numericDraftOrderId}" 
             style="display: inline-block; padding: 10px 15px; background-color: #951828; color: white; text-decoration: none; border-radius: 4px;">
            View Draft Order
          </a>
        </p>
      </div>
    `
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
  to: 'orders@ksesuppliers.com',
  subject: `Request Shipping Fee: ${draftOrderId}`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9f9f9;">
      <h2 style="color: #951828;">Place Order Request</h2>
      <p><strong>User ID:</strong> ${userId}</p>
      <p><strong>Draft Order ID:</strong> ${draftOrderId}</p>
      <p>The user has requested to place this draft order.</p>
      <p style="margin-top: 20px;">
        <a href="https://admin.shopify.com/store/kse-suppliers/draft_orders/${draftOrderId}" 
           style="display: inline-block; padding: 10px 15px; background-color: #951828; color: white; text-decoration: none; border-radius: 4px;">
          View Draft Order
        </a>
      </p>
    </div>
  `
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
