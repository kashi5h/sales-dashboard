/* ════════════════════════════════════════
   SMART SALES INSIGHT DASHBOARD — app.js
   ════════════════════════════════════════ */

const API = 'https://sales-dashboard-3h67.onrender.com/api';

// Chart instances (to destroy before re-render)
let charts = {};

// ══ UTILITIES ══════════════════════════════════════════════════════════════════

function fmt(num) {
  return '₹' + Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ══ NAVIGATION ═════════════════════════════════════════════════════════════════

const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section');
const pageTitle = document.getElementById('pageTitle');

navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const target = item.dataset.section;
    navItems.forEach(n => n.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`section-${target}`).classList.add('active');
    pageTitle.textContent = target.charAt(0).toUpperCase() + target.slice(1);
    if (target === 'analytics') loadAnalytics();
    if (target === 'prediction') loadPrediction();
    if (target === 'records') loadRecords();
  });
});

// ══ DATE ════════════════════════════════════════════════════════════════════════

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', {
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
});

// ══ CHART DEFAULTS ══════════════════════════════════════════════════════════════

Chart.defaults.color = '#6b7180';
Chart.defaults.font.family = "'DM Mono', monospace";
Chart.defaults.font.size = 11;

const CHART_COLORS = ['#e8ff47', '#47c8ff', '#ff6b47', '#a47fff', '#4cff91', '#ff47a8', '#ffa847'];

function gridOpts() {
  return { color: '#1e2130', drawBorder: false };
}

// ══ OVERVIEW ════════════════════════════════════════════════════════════════════

async function loadOverview() {
  try {
    // Summary
    const summary = await fetch(`${API}/sales/summary`).then(r => r.json());
    document.getElementById('totalRevenue').textContent = fmt(summary.totalRevenue);
    document.getElementById('totalOrders').textContent = summary.totalOrders.toLocaleString();
    document.getElementById('totalQuantity').textContent = summary.totalQuantity.toLocaleString();
    document.getElementById('avgOrderValue').textContent = fmt(summary.avgOrderValue);

    // Monthly Bar Chart
    const monthly = await fetch(`${API}/sales/monthly`).then(r => r.json());
    const labels = monthly.map(m => m.month);
    const revenues = monthly.map(m => m.revenue);

    destroyChart('monthlyBar');
    charts.monthlyBar = new Chart(document.getElementById('monthlyBarChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data: revenues,
          backgroundColor: 'rgba(232,255,71,0.15)',
          borderColor: '#e8ff47',
          borderWidth: 1.5,
          borderRadius: 5,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: gridOpts(), ticks: { maxRotation: 45 } },
          y: { grid: gridOpts(), ticks: { callback: v => '₹' + (v / 1000).toFixed(0) + 'k' } }
        }
      }
    });

    // Category Doughnut
    const catData = await fetch(`${API}/sales/by-category`).then(r => r.json());
    destroyChart('category');
    charts.category = new Chart(document.getElementById('categoryChart'), {
      type: 'doughnut',
      data: {
        labels: catData.map(c => c._id),
        datasets: [{
          data: catData.map(c => c.totalRevenue),
          backgroundColor: CHART_COLORS.map(c => c + '33'),
          borderColor: CHART_COLORS,
          borderWidth: 1.5,
        }]
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, boxWidth: 12 } }
        }
      }
    });

  } catch (err) {
    showToast('Failed to load overview. Is the server running?', 'error');
    console.error(err);
  }
}

// ══ ANALYTICS ═══════════════════════════════════════════════════════════════════

async function loadAnalytics() {
  try {
    const monthly = await fetch(`${API}/sales/monthly`).then(r => r.json());
    const labels = monthly.map(m => m.month);

    destroyChart('line');
    charts.line = new Chart(document.getElementById('lineChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data: monthly.map(m => m.revenue),
          borderColor: '#47c8ff',
          backgroundColor: 'rgba(71,200,255,0.08)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#47c8ff',
          tension: 0.4,
          fill: true,
        }, {
          label: 'Orders',
          data: monthly.map(m => m.orders),
          borderColor: '#ff6b47',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 3,
          tension: 0.4,
          yAxisID: 'y2',
        }]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: gridOpts() },
          y: { grid: gridOpts(), ticks: { callback: v => '₹' + (v / 1000).toFixed(0) + 'k' } },
          y2: { position: 'right', grid: { display: false }, ticks: { color: '#ff6b47' } }
        }
      }
    });

    const topProds = await fetch(`${API}/sales/top-products`).then(r => r.json());
    destroyChart('topProducts');
    charts.topProducts = new Chart(document.getElementById('topProductsChart'), {
      type: 'bar',
      data: {
        labels: topProds.map(p => p._id),
        datasets: [{
          label: 'Revenue',
          data: topProds.map(p => p.totalRevenue),
          backgroundColor: CHART_COLORS.map(c => c + '33'),
          borderColor: CHART_COLORS,
          borderWidth: 1.5,
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: gridOpts(), ticks: { callback: v => '₹' + (v / 1000).toFixed(0) + 'k' } },
          y: { grid: { display: false } }
        }
      }
    });

  } catch (err) {
    showToast('Failed to load analytics.', 'error');
    console.error(err);
  }
}

// ══ PREDICTION ══════════════════════════════════════════════════════════════════

async function loadPrediction() {
  try {
    const data = await fetch(`${API}/prediction`).then(r => r.json());

    document.getElementById('predSlope').textContent = data.slope ?? '—';
    document.getElementById('predIntercept').textContent = data.intercept ?? '—';

    const histLabels = data.historical.map(h => h.month);
    const histRevenue = data.historical.map(h => h.revenue);
    const histFitted = data.historical.map(h => h.fitted);
    const predLabels = data.predictions.map(p => p.month);
    const predValues = data.predictions.map(p => p.predictedRevenue);

    const allLabels = [...histLabels, ...predLabels];

    destroyChart('prediction');
    charts.prediction = new Chart(document.getElementById('predictionChart'), {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Actual Revenue',
            data: [...histRevenue, ...new Array(predLabels.length).fill(null)],
            borderColor: '#e8ff47',
            backgroundColor: 'rgba(232,255,71,0.06)',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.3,
            fill: true,
          },
          {
            label: 'Regression Line',
            data: [...histFitted, ...new Array(predLabels.length).fill(null)],
            borderColor: '#47c8ff',
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          },
          {
            label: 'Predicted Revenue',
            data: [...new Array(histLabels.length).fill(null), ...predValues],
            borderColor: '#a47fff',
            backgroundColor: 'rgba(164,127,255,0.12)',
            borderWidth: 2,
            pointRadius: 6,
            pointBackgroundColor: '#a47fff',
            borderDash: [6, 3],
            tension: 0.2,
            fill: true,
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: gridOpts(), ticks: { maxRotation: 45 } },
          y: { grid: gridOpts(), ticks: { callback: v => '₹' + (v / 1000).toFixed(0) + 'k' } }
        }
      }
    });

    // Prediction cards
    const predCards = document.getElementById('predCards');
    predCards.innerHTML = data.predictions.map(p => `
      <div class="pred-card">
        <div class="pred-card-month">${p.month}</div>
        <div class="pred-card-value">${fmt(p.predictedRevenue)}</div>
        <div class="pred-card-label">Predicted Revenue</div>
      </div>
    `).join('');

  } catch (err) {
    showToast('Failed to load predictions.', 'error');
    console.error(err);
  }
}

// ══ RECORDS ══════════════════════════════════════════════════════════════════════

async function loadRecords() {
  try {
    const sales = await fetch(`${API}/sales`).then(r => r.json());
    document.getElementById('recordCount').textContent = `${sales.length} records`;
    const tbody = document.getElementById('salesTableBody');

    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No records found.</td></tr>';
      return;
    }

    tbody.innerHTML = sales.map(s => `
      <tr>
        <td>${fmtDate(s.date)}</td>
        <td>${s.product}</td>
        <td>${s.category}</td>
        <td>${fmt(s.amount)}</td>
        <td>${s.quantity}</td>
        <td>${s.region}</td>
        <td><button class="delete-btn" onclick="deleteSale('${s._id}')">Delete</button></td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load records.', 'error');
    console.error(err);
  }
}

async function deleteSale(id) {
  if (!confirm('Delete this sale record?')) return;
  try {
    await fetch(`${API}/sales/${id}`, { method: 'DELETE' });
    showToast('Record deleted.', 'success');
    loadRecords();
    loadOverview();
  } catch (err) {
    showToast('Delete failed.', 'error');
  }
}

// ══ ADD SALE ══════════════════════════════════════════════════════════════════════

document.getElementById('addSaleBtn').addEventListener('click', async () => {
  const product  = document.getElementById('f-product').value.trim();
  const category = document.getElementById('f-category').value.trim();
  const amount   = parseFloat(document.getElementById('f-amount').value);
  const quantity = parseInt(document.getElementById('f-quantity').value);
  const date     = document.getElementById('f-date').value;
  const region   = document.getElementById('f-region').value.trim() || 'General';
  const msg      = document.getElementById('formMsg');

  if (!product || !category || isNaN(amount) || isNaN(quantity) || !date) {
    msg.textContent = '⚠ Fill in all required fields.';
    msg.style.color = '#ff6b47';
    return;
  }

  try {
    const res = await fetch(`${API}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product, category, amount, quantity, date, region }),
    });
    if (!res.ok) throw new Error('Server error');
    showToast('Sale added successfully!', 'success');
    msg.textContent = '';
    ['f-product','f-category','f-amount','f-quantity','f-date','f-region'].forEach(id => {
      document.getElementById(id).value = '';
    });
    loadRecords();
    loadOverview();
  } catch (err) {
    showToast('Failed to add sale.', 'error');
  }
});

// ══ SEED DATA ══════════════════════════════════════════════════════════════════════

document.getElementById('seedBtn').addEventListener('click', async () => {
  const btn = document.getElementById('seedBtn');
  btn.textContent = '⟳ Loading...';
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/sales/seed`, { method: 'POST' });
    const data = await res.json();
    showToast(data.message || 'Sample data loaded!', 'success');
    loadOverview();
  } catch (err) {
    showToast('Failed to seed data. Is the server running?', 'error');
  } finally {
    btn.textContent = '⟳ Load Sample Data';
    btn.disabled = false;
  }
});

// ══ INIT ════════════════════════════════════════════════════════════════════════════
loadOverview();
async function uploadFile() {
  const file = document.getElementById('fileInput').files[0];

  const formData = new FormData();
  formData.append('file', file);

  await fetch(`${API}/sales/upload`, {
    method: 'POST',
    body: formData
  });

  alert("Uploaded successfully!");
  loadOverview();
}
