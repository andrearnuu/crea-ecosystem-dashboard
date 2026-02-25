const express = require('express');
const http = require('http');
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

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database (JSON file) ───
const DEFAULT_DATA = {
  clients: [
    {id:1,name:"Fashion Brand Italia",brand:"LAB",status:"active",value:12000,email:"info@fashionbrand.it",phone:"333 1234567",notes:"Cliente storico dal 2024",created:"2025-06-15"},
    {id:2,name:"Tech Solutions Srl",brand:"LAB",status:"active",value:8500,email:"hello@techsol.it",phone:"333 9876543",notes:"Progetto web + branding",created:"2025-08-20"},
    {id:3,name:"Merch Express",brand:"STUDIO",status:"active",value:15000,email:"ordini@merchexpress.it",phone:"335 5551234",notes:"Ordine merchandising grande",created:"2025-03-10"},
    {id:4,name:"Bar Centrale",brand:"STUDIO",status:"pending",value:3200,email:"barcentrale@email.it",phone:"339 4445678",notes:"In attesa preventivo packaging",created:"2026-01-05"},
    {id:5,name:"Ristorante Luna",brand:"LAB",status:"active",value:5800,email:"info@ristoranteluna.it",phone:"338 7771234",notes:"Social media management mensile",created:"2025-11-12"}
  ],
  team: [
    {id:1,name:"Andrea Arnuzzo",role:"CEO / Founder",brand:"Entrambi",projects:5,workload:85,email:"andrea@crealab.it",status:"active"},
    {id:2,name:"Marco Rossi",role:"Graphic Designer",brand:"LAB",projects:3,workload:70,email:"marco@crealab.it",status:"active"},
    {id:3,name:"Sara Bianchi",role:"Social Media Manager",brand:"LAB",projects:4,workload:90,email:"sara@crealab.it",status:"active"},
    {id:4,name:"Luca Verdi",role:"Production Manager",brand:"STUDIO",projects:2,workload:55,email:"luca@creastudio.it",status:"active"}
  ],
  projects: [
    {id:1,name:"Rebranding Fashion Brand",client:"Fashion Brand Italia",brand:"LAB",status:"in_progress",progress:65,deadline:"2026-03-15",budget:8000,spent:4200,assignee:"Marco Rossi",description:"Rebranding completo: logo, identity, linee guida"},
    {id:2,name:"E-commerce Tech Solutions",client:"Tech Solutions Srl",brand:"LAB",status:"in_progress",progress:40,deadline:"2026-04-30",budget:12000,spent:3500,assignee:"Andrea Arnuzzo",description:"Sviluppo e-commerce con catalogo prodotti"},
    {id:3,name:"Catalogo Merch 2026",client:"Merch Express",brand:"STUDIO",status:"review",progress:85,deadline:"2026-03-01",budget:6000,spent:5100,assignee:"Luca Verdi",description:"Catalogo prodotti merchandising annuale"},
    {id:4,name:"Social Media Pack Luna",client:"Ristorante Luna",brand:"LAB",status:"in_progress",progress:30,deadline:"2026-05-01",budget:3500,spent:800,assignee:"Sara Bianchi",description:"Pacchetto social 3 mesi"},
    {id:5,name:"Packaging Bar Centrale",client:"Bar Centrale",brand:"STUDIO",status:"backlog",progress:0,deadline:"2026-06-01",budget:2500,spent:0,assignee:"Marco Rossi",description:"Design packaging prodotti bar"}
  ],
  automations: [
    {id:1,name:"Email Benvenuto Cliente",description:"Invia email automatica a ogni nuovo cliente aggiunto",trigger:"Nuovo cliente",active:true,runs:23,lastRun:"2026-02-20T10:30:00"},
    {id:2,name:"Report Settimanale",description:"Genera report PDF ogni lunedì con KPI della settimana",trigger:"Ogni Lunedì 9:00",active:true,runs:45,lastRun:"2026-02-24T09:00:00"},
    {id:3,name:"Notifica Scadenza Progetto",description:"Avvisa 7 giorni prima della scadenza di un progetto",trigger:"7gg prima scadenza",active:true,runs:12,lastRun:"2026-02-22T08:00:00"},
    {id:4,name:"Backup Dati Giornaliero",description:"Salva copia dei dati ogni sera alle 23:00",trigger:"Ogni giorno 23:00",active:false,runs:0,lastRun:null},
    {id:5,name:"Fattura Automatica",description:"Genera fattura al completamento progetto",trigger:"Progetto completato",active:true,runs:8,lastRun:"2026-02-18T14:22:00"}
  ],
  finance: [
    {id:1,date:"2026-02-20",description:"Pagamento Fashion Brand - Rebranding",brand:"LAB",type:"entrata",amount:4000},
    {id:2,date:"2026-02-18",description:"Abbonamento Adobe CC",brand:"LAB",type:"uscita",amount:350},
    {id:3,date:"2026-02-15",description:"Acconto Merch Express - Catalogo",brand:"STUDIO",type:"entrata",amount:3000},
    {id:4,date:"2026-02-12",description:"Fornitore Stampa - Merch",brand:"STUDIO",type:"uscita",amount:1200},
    {id:5,date:"2026-02-10",description:"Social Media Pack - Ristorante Luna",brand:"LAB",type:"entrata",amount:1500},
    {id:6,date:"2026-02-05",description:"Hosting e Domini",brand:"LAB",type:"uscita",amount:180},
    {id:7,date:"2026-01-28",description:"Pagamento Tech Solutions",brand:"LAB",type:"entrata",amount:3500}
  ],
  activity: [],
  settings: {
    companyName: "CREA",
    brand1: "CREA LAB",
    brand2: "CREA STUDIO",
    email: "info@creaecosystem.it"
  }
};

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const data = JSON.parse(raw);
      // Ensure all keys exist
      for (const key of Object.keys(DEFAULT_DATA)) {
        if (!data[key]) data[key] = JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
      }
      return data;
    }
  } catch (e) {
    console.error('DB load error:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let db = loadDB();
saveDB(db); // Ensure file exists

function addActivity(action, detail) {
  db.activity.unshift({ action, detail, date: new Date().toISOString() });
  if (db.activity.length > 100) db.activity = db.activity.slice(0, 100);
  saveDB(db);
}

function broadcast(event, data) {
  io.emit(event, data);
}

function getNextId(collection) {
  return db[collection].length ? Math.max(...db[collection].map(x => x.id)) + 1 : 1;
}

// ─── API ROUTES ───

// Get all data (initial load)
app.get('/api/data', (req, res) => {
  res.json(db);
});

// Get specific collection
app.get('/api/:collection', (req, res) => {
  const { collection } = req.params;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  res.json(db[collection]);
});

// Get single item
app.get('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const item = db[collection].find(x => x.id === parseInt(id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// Create item
app.post('/api/:collection', (req, res) => {
  const { collection } = req.params;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  const item = { ...req.body, id: getNextId(collection) };
  db[collection].push(item);
  addActivity(`Nuovo ${collection.slice(0,-1)}`, `Aggiunto: ${item.name || item.description || 'N/D'}`);
  saveDB(db);
  broadcast('data_update', { collection, action: 'create', item });
  broadcast('activity_update', db.activity[0]);
  res.status(201).json(item);
});

// Update item
app.put('/api/:collection/:id', (req, res) => {
  const { collection, id } = req.params;
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

// Delete item
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

// Bulk update (for reordering, mass changes)
app.put('/api/:collection', (req, res) => {
  const { collection } = req.params;
  if (!db[collection]) return res.status(404).json({ error: 'Collection not found' });
  db[collection] = req.body;
  addActivity(`Aggiornamento bulk`, `${collection} aggiornato completamente`);
  saveDB(db);
  broadcast('data_update', { collection, action: 'bulk', items: db[collection] });
  res.json(db[collection]);
});

// Update settings
app.put('/api/settings', (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  saveDB(db);
  broadcast('settings_update', db.settings);
  res.json(db.settings);
});

// AI Insights endpoint
app.get('/api/ai/insights', (req, res) => {
  const insights = [];

  // Scadenze vicine
  db.projects.filter(p => p.status !== 'completed').forEach(p => {
    const daysLeft = Math.ceil((new Date(p.deadline) - new Date()) / 86400000);
    if (daysLeft < 14) {
      insights.push({
        type: 'deadline', priority: daysLeft < 7 ? 'high' : 'medium',
        title: `⏰ "${p.name}" scade tra ${daysLeft} giorni`,
        description: `Scadenza: ${p.deadline}. Avanzamento: ${p.progress}%. ${p.progress < 50 ? 'Significativamente in ritardo!' : 'Monitora la chiusura.'}`
      });
    }
  });

  // Workload alto
  db.team.filter(t => t.workload > 80).forEach(t => {
    insights.push({
      type: 'workload', priority: 'high',
      title: `🔥 ${t.name} ha workload al ${t.workload}%`,
      description: `Redistribuire task per evitare burnout. Un carico >80% prolungato riduce la qualità.`
    });
  });

  // Clienti pending
  db.clients.filter(c => c.status === 'pending').forEach(c => {
    insights.push({
      type: 'client', priority: 'medium',
      title: `📞 "${c.name}" in attesa`,
      description: `Valore potenziale: €${c.value.toLocaleString()}. Fare follow-up per non perdere l'opportunità.`
    });
  });

  // Budget
  const totalBudget = db.projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent = db.projects.reduce((s, p) => s + p.spent, 0);
  if (totalBudget > 0 && totalSpent > totalBudget * 0.7) {
    insights.push({
      type: 'budget', priority: totalSpent > totalBudget * 0.9 ? 'high' : 'medium',
      title: `💰 Budget al ${Math.round(totalSpent / totalBudget * 100)}%`,
      description: `Speso €${totalSpent.toLocaleString()} su €${totalBudget.toLocaleString()}. Monitorare attentamente.`
    });
  }

  // Automazioni inattive
  const inactive = db.automations.filter(a => !a.active);
  if (inactive.length) {
    insights.push({
      type: 'automation', priority: 'low',
      title: `⚡ ${inactive.length} automazione/i disattivata/e`,
      description: `Inattive: ${inactive.map(a => a.name).join(', ')}. Valuta se riattivarle.`
    });
  }

  if (!insights.length) {
    insights.push({ type: 'ok', priority: 'low', title: '✅ Tutto nella norma!', description: 'Nessuna criticità evidenziata.' });
  }

  res.json(insights);
});

// ─── WebSocket ───
io.on('connection', (socket) => {
  console.log(`🟢 Client connesso: ${socket.id}`);
  // Send current data on connect
  socket.emit('init', db);

  socket.on('disconnect', () => {
    console.log(`🔴 Client disconnesso: ${socket.id}`);
  });
});

// ─── Start ───
server.listen(PORT, HOST, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   🚀 CREA ECOSYSTEM DASHBOARD            ║`);
  console.log(`║   Server attivo su http://localhost:${PORT}  ║`);
  console.log(`║   Real-time: WebSocket attivo             ║`);
  console.log(`║   Database: ${DB_PATH}       ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
