# Database Configuration Setup

## Step 2: Environment Variables

Create a `.env` file in your project root with the following content:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=kse_user
DB_PASSWORD=your_secure_password
DB_DATABASE=kse_shopify
DB_SYNCHRONIZE=true
DB_LOGGING=true

# Shopify Configuration (existing)
SHOPIFY_API_URL=https://kse-suppliers.myshopify.com/admin/api/2024-01/graphql.json
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
SHOPIFY_REST_API_URL=https://kse-suppliers.myshopify.com/admin/api/2024-01
SHOPIFY_REST_API_URL_2=https://kse-suppliers.myshopify.com/admin/api/2024-01

# Email Configuration (if needed)
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

## Instructions:

1. **Create `.env` file** in the project root (`kse_shopify/.env`)
2. **Copy the content above** into the `.env` file
3. **Update the values** with your actual credentials:
   - `DB_PASSWORD`: Choose a secure password for your database
   - `SHOPIFY_ACCESS_TOKEN`: Your actual Shopify access token
   - Other values can remain as shown for local development

## Next Steps:
- Step 3: Set up PostgreSQL database
- Step 4: Create database entities
- Step 5: Configure TypeORM module

**Important**: Never commit the `.env` file to version control!
