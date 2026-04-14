# Backend API Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

3. **Start backend:**
   ```bash
   npm start
   ```

Backend runs on `http://localhost:5000`

## Environment Variables

Create a `.env` file with:

```env
# Database connection
DATABASE_URL=postgresql://shopping_cart_user:shopping_cart_password@localhost:5433/shopping_cart

# Server
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
CORS_ORIGIN=http://localhost:3000
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Get All Products
```
GET /api/products

Response:
[
  {
    "id": "...",
    "name": "Product Name",
    "description": "...",
    "price": "29.99",
    "category": "Category Name",
    "stock": 100
  }
]
```

### Get Categories
```
GET /api/categories

Response:
[
  {
    "id": "...",
    "name": "Category Name",
    "description": "..."
  }
]
```

### Checkout (Save Order)
```
POST /api/checkout

Body:
{
  "userId": "guest-user",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    },
    {
      "productId": "uuid",
      "quantity": 1
    }
  ]
}

Response:
{
  "success": true,
  "billId": "uuid",
  "total": "159.97",
  "message": "Checkout successful"
}
```

## Database Schema Used

The backend connects to these tables:

- `inventory.category` - Product categories
- `inventory.product` - Product catalog
- `inventory.inventory` - Stock quantities
- `bill.bill` - Orders/bills (created on checkout)
- `bill.bill_item` - Order line items (created on checkout)
- `security.user` - User table (for user_id foreign key)

## Dependencies

- **express** - Web framework
- **pg** - PostgreSQL client
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variables
- **uuid** - UUID utilities

## Development

Run with hot-reload using nodemon:
```bash
npm run dev
```

## Troubleshooting

### Connection Error
- Verify PostgreSQL is running on port 5433
- Check database URL in .env
- Test connection: `psql -U shopping_cart_user -d shopping_cart -h localhost -p 5433`

### CORS Error
- Frontend and backend on same machine? Check CORS_ORIGIN in .env
- Should be `http://localhost:3000` for local dev
