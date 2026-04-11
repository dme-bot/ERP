require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./db/schema');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS - allow all origins in dev, restrict in production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Trust proxy for cloud deployments
app.set('trust proxy', 1);

// Initialize DB
initializeDatabase();

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/procurement', require('./routes/procurement'));
app.use('/api/installation', require('./routes/installation'));
app.use('/api/hr', require('./routes/hr'));

// Health check for deployment platforms
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuild, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================`);
  console.log(`  Business ERP Server`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`======================================\n`);
});
