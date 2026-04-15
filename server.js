require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function resolveCheckoutUserId(client, requestedUserId) {
  if (requestedUserId) {
    const userResult = await client.query(
      `
        SELECT id
        FROM security."user"
        WHERE id = $1 AND state = 'ACTIVE'
      `,
      [requestedUserId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Provided userId was not found or is inactive');
    }

    return userResult.rows[0].id;
  }

  const guestIdentity = {
    username: 'guest_checkout',
    email: 'guest_checkout@local'
  };

  const existingGuest = await client.query(
    `
      SELECT id
      FROM security."user"
      WHERE username = $1 OR email = $2
      LIMIT 1
    `,
    [guestIdentity.username, guestIdentity.email]
  );

  if (existingGuest.rows.length > 0) {
    return existingGuest.rows[0].id;
  }

  let roleId;
  const roleResult = await client.query(
    `
      SELECT id
      FROM security.role
      WHERE state = 'ACTIVE'
      ORDER BY created_at ASC
      LIMIT 1
    `
  );

  if (roleResult.rows.length > 0) {
    roleId = roleResult.rows[0].id;
  } else {
    const createdRole = await client.query(
      `
        INSERT INTO security.role (name, description, created_by)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      ['Guest', 'Role used for anonymous checkout', 'shopping_cart_app']
    );
    roleId = createdRole.rows[0].id;
  }

  const createdGuest = await client.query(
    `
      INSERT INTO security."user" (username, email, password, role_id, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      guestIdentity.username,
      guestIdentity.email,
      'guest_checkout_not_for_login',
      roleId,
      'shopping_cart_app'
    ]
  );

  return createdGuest.rows[0].id;
}

// Routes
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.description, p.price, c.name as category, COALESCE(i.quantity, 0) as stock
      FROM inventory.product p
      LEFT JOIN inventory.category c ON p.category_id = c.id
      LEFT JOIN inventory.inventory i ON p.id = i.product_id
      WHERE p.state = 'ACTIVE'
      ORDER BY p.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description
      FROM inventory.category
      WHERE state = 'ACTIVE'
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { items, userId } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Resolve a valid checkout user to satisfy bill.user_id FK.
      const finalUserId = await resolveCheckoutUserId(client, userId);

      // Validate products, calculate total, and reserve stock
      let total = 0;
      const resolvedItems = [];
      for (const item of items) {
        if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new Error('Each cart item must include a valid productId and quantity');
        }

        const priceResult = await client.query(
          `
            SELECT price
            FROM inventory.product
            WHERE id = $1 AND state = 'ACTIVE'
          `,
          [item.productId]
        );
        if (priceResult.rows.length === 0) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const stockResult = await client.query(
          `
            SELECT quantity
            FROM inventory.inventory
            WHERE product_id = $1
            FOR UPDATE
          `,
          [item.productId]
        );

        if (stockResult.rows.length === 0) {
          throw new Error(`Inventory record for product ${item.productId} not found`);
        }

        const unitPrice = priceResult.rows[0].price;
        const stock = stockResult.rows[0].quantity;
        if (stock < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }

        total += unitPrice * item.quantity;
        resolvedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice
        });
      }

      // Create bill
      const billResult = await client.query(
        'INSERT INTO bill.bill (user_id, total, created_by) VALUES ($1, $2, $3) RETURNING id',
        [finalUserId, total, 'shopping_cart_app']
      );
      const billId = billResult.rows[0].id;

      // Add bill items
      for (const item of resolvedItems) {
        const itemTotal = item.unitPrice * item.quantity;

        await client.query(
          'INSERT INTO bill.bill_item (bill_id, product_id, quantity, unit_price, total, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [billId, item.productId, item.quantity, item.unitPrice, itemTotal, 'shopping_cart_app']
        );

        await client.query(
          `
            UPDATE inventory.inventory
            SET quantity = quantity - $2,
                updated_at = NOW(),
                updated_by = $3
            WHERE product_id = $1
          `,
          [item.productId, item.quantity, 'shopping_cart_app']
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ 
        success: true, 
        billId,
        total,
        message: 'Checkout successful'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error during checkout:', error);
    res.status(500).json({ error: error.message || 'Checkout failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL}`);
});
