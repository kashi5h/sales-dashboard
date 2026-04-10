const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');

/**
 * Simple Linear Regression
 * y = mx + b
 * Predicts next N months of revenue based on historical monthly data.
 */
function linearRegression(xValues, yValues) {
  const n = xValues.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

// ─── GET prediction for next 3 months ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const sales = await Sale.find();

    if (sales.length === 0) {
      return res.json({ historical: [], predictions: [], message: 'No data available for prediction.' });
    }

    // Build monthly revenue map
    const monthly = {};
    sales.forEach((s) => {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + s.amount;
    });

    const sorted = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b));

    const xValues = sorted.map((_, i) => i + 1); // 1, 2, 3, ...
    const yValues = sorted.map(([, rev]) => rev);

    const { slope, intercept } = linearRegression(xValues, yValues);

    // Build historical data for chart
    const historical = sorted.map(([month, revenue], i) => ({
      month,
      revenue: parseFloat(revenue.toFixed(2)),
      fitted: parseFloat((slope * (i + 1) + intercept).toFixed(2)),
    }));

    // Predict next 3 months
    const lastDate = new Date(sorted[sorted.length - 1][0] + '-01');
    const predictions = [];
    for (let i = 1; i <= 3; i++) {
      const futureDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
      const futureKey = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;
      const predictedRevenue = slope * (sorted.length + i) + intercept;
      predictions.push({
        month: futureKey,
        predictedRevenue: parseFloat(Math.max(0, predictedRevenue).toFixed(2)),
      });
    }

    res.json({ historical, predictions, slope: parseFloat(slope.toFixed(2)), intercept: parseFloat(intercept.toFixed(2)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
