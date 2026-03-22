/**
 * Creates an Express app instance for integration testing
 * without binding to a port.
 */
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Mount all routes
app.use('/api/auth', require('../routes/auth'));
app.use('/api/transactions', require('../routes/transactions'));
app.use('/api/budgets', require('../routes/budgets'));
app.use('/api/goals', require('../routes/goals'));
app.use('/api/categories', require('../routes/categories'));
app.use('/api/reports', require('../routes/reports'));
app.use('/api/notifications', require('../routes/notifications'));

module.exports = app;
