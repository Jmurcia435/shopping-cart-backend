require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Fixed UUID for guest user
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000001';

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

// Routes
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.description, p.price, c.name as category, i.quantity as stock
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

      // Generate UUID for guest user if not provided
      const finalUserId = userId || GUEST_USER_ID;

      // Calculate total
      let total = 0;
      for (const item of items) {
        const result = await client.query(
          'SELECT price FROM inventory.product WHERE id = $1',
          [item.productId]
        );
        if (result.rows.length === 0) {
          throw new Error(`Product ${item.productId} not found`);
        }
        total += result.rows[0].price * item.quantity;
      }

      // Create bill
      const billResult = await client.query(
        'INSERT INTO bill.bill (user_id, total, created_by) VALUES ($1, $2, $3) RETURNING id',
        [finalUserId, total, 'shopping_cart_app']
      );
      const billId = billResult.rows[0].id;

      // Add bill items
      for (const item of items) {
        const productResult = await client.query(
          'SELECT price FROM inventory.product WHERE id = $1',
          [item.productId]
        );
        const unitPrice = productResult.rows[0].price;
        const itemTotal = unitPrice * item.quantity;

        await client.query(
          'INSERT INTO bill.bill_item (bill_id, product_id, quantity, unit_price, total, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [billId, item.productId, item.quantity, unitPrice, itemTotal, 'shopping_cart_app']
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
