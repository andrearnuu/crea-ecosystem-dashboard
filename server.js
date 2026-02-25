const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DB_PATH = path.join(__dirname, 'data.json');

// ─── WooCommerce Config ───
const WC_URL = 'https://crealabprint.it/wp-json/wc/v3';
const WC_KEY = 'ck_2c395f7eb3eb54c542bb4351dd1ebbd942f5d144';
const WC_SECRET = 'cs_78d8232bb73e03108f5128c1d38ab30a22c3e241';

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database (JSON file) ───
const DEFAULT_DATA = {
  clients: [], team: [], projects: [], automations: [], finance: [],
  activity: [], calendar: [], woo_orders: [],
  contracts: [], subscriptions: [], lab_orders: [],
  settings: { companyName: "CREA", brand1: "CREA STUDIO", brand2: "CREA LAB", email: "hello@crea-studio.it" }
};

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const data = JSON.parse(raw);
      for (const key of Object.keys(DEFAULT_DATA)) {
        if (!data[key]) data[key] = JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
      }
      return data;
    }
  } catch (e) { console.error('DB load error:', e.message); }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

let db = loadDB();
saveDB(db);

function addActivity(action, detail) {
  db.activity.unshift({ action, detail, date: new Date().toISOString() });
  if (db.activity.length > 100) db.activity = db.activity.slice(0, 100);
  saveDB(db);
}
function broadcast(event, data) { io.emit(event, data); }
function getNextId(collection) {
  return db[collection] && db[collection].length ? Math.max(...db[collection].map(x => x.id)) + 1 : 1;
}

// ─── WooCommerce API ───
function wcFetch(endpoint) {
  return new Promise((resolve, reject) => {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${WC_URL}${endpoint}${sep}consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Get WooCommerce orders
app.get('/api/woo/orders', async (req, res) => {
  try {
    const orders = await wcFetch('/orders?per_page=50&orderby=date&order=desc');
    db.woo_orders = orders.map(o => ({
      id: o.id,
      number: o.number,
      status: o.status,
      total: o.total,
      currency: o.currency,
      customer: `${o.billing.first_name} ${o.billing.last_name}`,
      email: o.billing.email,
      phone: o.billing.phone,
      city: o.billing.city,
      date: o.date_created,
      items: (o.line_items || []).map(i => ({ name: i.name, qty: i.quantity, total: i.total })),
      payment_method: o.payment_method_title,
      note: o.customer_note || ''
    }));
    saveDB(db);
    broadcast('woo_update', db.woo_orders);
    res.json(db.woo_orders);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get WooCommerce stats
app.get('/api/woo/stats', async (req, res) => {
  try {
    const orders = db.woo_orders.length ? db.woo_orders : await wcFetch('/orders?per_page=100');
    const processed = Array.isArray(orders) ? orders : [];
    const stats = {
      total_orders: processed.length,
      total_revenue: processed.reduce((s, o) => s + parseFloat(o.total || 0), 0),
      processing: processed.filter(o => (o.status || '') === 'processing').length,
      completed: processed.filter(o => (o.status || '') === 'completed').length,
      pending: processed.filter(o => (o.status || '') === 'pending').length,
      refunded: processed.filter(o => (o.status || '') === 'refunded').length,
    };
    res.json(stats);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get WooCommerce products
app.get('/api/woo/products', async (req, res) => {
  try {
    const products = await wcFetch('/products?per_page=50');
    res.json(products.map(p => ({
      id: p.id, name: p.name, price: p.price, regular_price: p.regular_price,
      stock: p.stock_quantity, status: p.status, type: p.type,
      categories: (p.categories||[]).map(c => c.name),
      image: p.images && p.images[0] ? p.images[0].src : null
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Calendar API ───
app.get('/api/calendar', (req, res) => {
  if (!db.calendar) db.calendar = [];
  res.json(db.calendar);
});

app.post('/api/calendar', (req, res) => {
  if (!db.calendar) db.calendar = [];
  const event = { ...req.body, id: db.calendar.length ? Math.max(...db.calendar.map(x=>x.id)) + 1 : 1 };
  db.calendar.push(event);
  addActivity('Calendario', `Nuovo post: "${event.title}" per ${event.client}`);
  saveDB(db);
  broadcast('calendar_update', db.calendar);
  res.status(201).json(event);
});

app.put('/api/calendar/:id', (req, res) => {
  if (!db.calendar) db.calendar = [];
  const idx = db.calendar.findIndex(x => x.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.calendar[idx] = { ...db.calendar[idx], ...req.body, id: parseInt(req.params.id) };
  saveDB(db);
  broadcast('calendar_update', db.calendar);
  res.json(db.calendar[idx]);
});

app.delete('/api/calendar/:id', (req, res) => {
  if (!db.calendar) db.calendar = [];
  db.calendar = db.calendar.filter(x => x.id !== parseInt(req.params.id));
  saveDB(db);
  broadcast('calendar_update', db.calendar);
  res.json({ success: true });
});

// ─── Standard API ROUTES ───
app.get('/api/data', (req, res) => res.json(db));

app.get('/api/:collection', (req, res) => {
  const { collection } = req.params;
  if (collection === 'woo' || collection === 'ai' || collection === 'calendar') return;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  res.json(db[collection]);
});

app.get('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const item = db[collection].find(x => x.id === parseInt(id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

app.post('/api/:collection', (req, res) => {
  const { collection } = req.params;
  if (collection === 'calendar' || collection === 'woo') return;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const item = { ...req.body, id: getNextId(collection) };
  db[collection].push(item);
  addActivity(`Nuovo ${collection.slice(0,-1)}`, `Aggiunto: ${item.name || item.description || 'N/D'}`);
  saveDB(db);
  broadcast('data_update', { collection, action: 'create', item });
  broadcast('activity_update', db.activity[0]);
  res.status(201).json(item);
});

app.put('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  if (collection === 'calendar') return;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const idx = db[collection].findIndex(x => x.id === parseInt(id));
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  db[collection][idx] = { ...db[collection][idx], ...req.body, id: parseInt(id) };
  addActivity(`Modifica ${collection.slice(0,-1)}`, `Aggiornato: ${db[collection][idx].name || db[collection][idx].description || 'N/D'}`);
  saveDB(db);
  broadcast('data_update', { collection, action: 'update', item: db[collection][idx] });
  broadcast('activity_update', db.activity[0]);
  res.json(db[collection][idx]);
});

app.delete('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const item = db[collection].find(x => x.id === parseInt(id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  db[collection] = db[collection].filter(x => x.id !== parseInt(id));
  addActivity(`Eliminazione`, `Rimosso da ${collection}: ${item.name || item.description || 'N/D'}`);
  saveDB(db);
  broadcast('data_update', { collection, action: 'delete', id: parseInt(id) });
  broadcast('activity_update', db.activity[0]);
  res.json({ success: true });
});

app.put('/api/:collection', (req, res) => {
  const { collection } = req.params;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  db[collection] = req.body;
  addActivity(`Aggiornamento bulk`, `${collection} aggiornato completamente`);
  saveDB(db);
  broadcast('data_update', { collection, action: 'bulk', items: db[collection] });
  res.json(db[collection]);
});

app.put('/api/settings', (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  saveDB(db);
  broadcast('settings_update', db.settings);
  res.json(db.settings);
});

// AI Insights
app.get('/api/ai/insights', (req, res) => {
  const insights = [];
  db.projects.filter(p => p.status !== 'completed').forEach(p => {
    const daysLeft = Math.ceil((new Date(p.deadline) - new Date()) / 86400000);
    if (daysLeft < 14) {
      insights.push({ type:'deadline', priority: daysLeft<7?'high':'medium',
        title:`\u23F0 "${p.name}" scade tra ${daysLeft} giorni`,
        description:`Scadenza: ${p.deadline}. Avanzamento: ${p.progress}%. ${p.progress<50?'In ritardo!':'Monitora la chiusura.'}`
      });
    }
  });
  db.team.filter(t => t.workload > 80).forEach(t => {
    insights.push({ type:'workload', priority:'high',
      title:`\uD83D\uDD25 ${t.name} ha workload al ${t.workload}%`,
      description:`Redistribuire task per evitare burnout.`
    });
  });
  db.clients.filter(c => c.status === 'pending').forEach(c => {
    insights.push({ type:'client', priority:'medium',
      title:`\uD83D\uDCDE "${c.name}" in attesa`,
      description:`Valore potenziale: \u20AC${c.value.toLocaleString()}. Fare follow-up.`
    });
  });
  // WooCommerce insights
  const processingOrders = (db.woo_orders||[]).filter(o => o.status === 'processing');
  if (processingOrders.length) {
    insights.push({ type:'woo', priority:'medium',
      title:`\uD83D\uDCE6 ${processingOrders.length} ordini WooCommerce da evadere`,
      description:`Ordini in lavorazione su crealabprint.it. Controlla la sezione CREA LAB.`
    });
  }
  if (!insights.length) {
    insights.push({ type:'ok', priority:'low', title:'\u2705 Tutto nella norma!', description:'Nessuna criticità.' });
  }
  res.json(insights);
});

// ─── WebSocket ───
io.on('connection', (socket) => {
  console.log(`\uD83D\uDFE2 Client connesso: ${socket.id}`);
  socket.emit('init', db);
  socket.on('disconnect', () => {
    console.log(`\uD83D\uDD34 Client disconnesso: ${socket.id}`);
  });
});

// ─── Anti-sleep ping (keeps Render free tier awake) ───
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    https.get(RENDER_URL + '/api/data', () => {}).on('error', () => {});
  }, 14 * 60 * 1000); // Every 14 minutes
}

// ─── Auto-refresh WooCommerce orders every 5 min ───
async function refreshWooOrders() {
  try {
    const orders = await wcFetch('/orders?per_page=50&orderby=date&order=desc');
    db.woo_orders = orders.map(o => ({
      id: o.id, number: o.number, status: o.status, total: o.total,
      currency: o.currency,
      customer: `${o.billing.first_name} ${o.billing.last_name}`,
      email: o.billing.email, phone: o.billing.phone, city: o.billing.city,
      date: o.date_created,
      items: (o.line_items||[]).map(i => ({ name: i.name, qty: i.quantity, total: i.total })),
      payment_method: o.payment_method_title, note: o.customer_note || ''
    }));
    saveDB(db);
    broadcast('woo_update', db.woo_orders);
    console.log(`\uD83D\uDED2 WooCommerce: ${orders.length} ordini sincronizzati`);
  } catch(e) { console.error('WooCommerce sync error:', e.message); }
}
setInterval(refreshWooOrders, 5 * 60 * 1000);
setTimeout(refreshWooOrders, 5000); // First sync 5s after boot

// ─── Start ───
server.listen(PORT, HOST, () => {
  console.log(`\n\u2550 CREA ECOSYSTEM DASHBOARD`);
  console.log(`  Server: http://localhost:${PORT}`);
  console.log(`  WebSocket: attivo`);
  console.log(`  WooCommerce: crealabprint.it (sync ogni 5min)`);
  console.log(`  Anti-sleep: ${RENDER_URL ? 'attivo' : 'disattivato (no RENDER_URL)'}\n`);
});
