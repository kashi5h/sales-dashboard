const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');

const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// ─── GET all sales ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST add a new sale ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const sale = new Sale(req.body);
    const saved = await sale.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── DELETE a sale ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET summary metrics ──────────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const sales = await Sale.find();

    const totalRevenue = sales.reduce((sum, s) => sum + s.amount, 0);
    const totalOrders = sales.length;
    const totalQuantity = sales.reduce((sum, s) => sum + s.quantity, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    res.json({ totalRevenue, totalOrders, totalQuantity, avgOrderValue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET monthly sales (for line/bar chart) ───────────────────────────────────
router.get('/monthly', async (req, res) => {
  try {
    const sales = await Sale.find();

    // Group by year-month
    const monthly = {};
    sales.forEach((s) => {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthly[key]) monthly[key] = { revenue: 0, orders: 0 };
      monthly[key].revenue += s.amount;
      monthly[key].orders += 1;
    });

    // Sort by date
    const sorted = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET sales by category (for pie/doughnut chart) ──────────────────────────
router.get('/by-category', async (req, res) => {
  try {
    const result = await Sale.aggregate([
      {
        $group: {
          _id: '$category',
          totalRevenue: { $sum: '$amount' },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET top products ─────────────────────────────────────────────────────────
router.get('/top-products', async (req, res) => {
  try {
    const result = await Sale.aggregate([
      {
        $group: {
          _id: '$product',
          totalRevenue: { $sum: '$amount' },
          totalQuantity: { $sum: '$quantity' },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST seed sample data ─────────────────────────────────────────────────────
router.post('/seed', async (req, res) => {
  try {
    await Sale.deleteMany({});

    const categories = ['Electronics', 'Clothing', 'Food', 'Books', 'Sports'];
    const products = {
      Electronics: ['Laptop', 'Phone', 'Tablet', 'Headphones', 'Smartwatch'],
      Clothing: ['T-Shirt', 'Jeans', 'Jacket', 'Dress', 'Sneakers'],
      Food: ['Coffee Pack', 'Protein Bar', 'Olive Oil', 'Tea Box', 'Nuts Pack'],
      Books: ['Fiction Novel', 'Tech Book', 'Self-Help', 'Science Book', 'Cookbook'],
      Sports: ['Yoga Mat', 'Dumbbells', 'Running Shoes', 'Cycling Helmet', 'Water Bottle'],
    };
    const regions = ['North', 'South', 'East', 'West'];

    const sampleSales = [];
    const now = new Date();

    for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
      const numSales = Math.floor(Math.random() * 15) + 10;
      for (let i = 0; i < numSales; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const product = products[category][Math.floor(Math.random() * 5)];
        const date = new Date(now.getFullYear(), now.getMonth() - monthOffset, Math.floor(Math.random() * 28) + 1);
        sampleSales.push({
          product,
          category,
          amount: parseFloat((Math.random() * 4500 + 500).toFixed(2)),
          quantity: Math.floor(Math.random() * 20) + 1,
          date,
          region: regions[Math.floor(Math.random() * regions.length)],
        });
      }
    }

    await Sale.insertMany(sampleSales);
    res.json({ message: `✅ Seeded ${sampleSales.length} sample sales records.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), async (req, res) => {
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      results.push({
        product: data.product,
        category: data.category,
        amount: Number(data.amount),
        quantity: Number(data.quantity),
        date: new Date(data.date),
        region: data.region
      });
    })
    .on('end', async () => {
      await Sale.insertMany(results);
      fs.unlinkSync(req.file.path);
      res.json({ message: 'File uploaded successfully!' });
    });
});
module.exports = router;
