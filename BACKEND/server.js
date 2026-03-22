const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const express = require('express');
const http = require('node:http');
const mongoose = require('mongoose');
const cors = require('cors');
const { initializeScheduler } = require('./services/schedulerService');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
	.split(',')
	.map(origin => origin.trim())
	.filter(Boolean);

const defaultDevOrigins = ['http://localhost:3000', 'http://localhost:3001'];
const corsOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultDevOrigins;

// CORS configuration
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

const MONGO_RETRY_MS = 10000;
let schedulerInitialized = false;

function connectToMongo() {
	const mongoUri = process.env.DB_URI || process.env.MONGO_URI;

	if (!mongoUri) {
		console.error('MongoDB connection string missing. Set DB_URI or MONGO_URI. Retrying...');
		setTimeout(connectToMongo, MONGO_RETRY_MS);
		return;
	}

	mongoose.connect(mongoUri)
		.then(() => {
			console.log('MongoDB connected');
			if (!schedulerInitialized) {
				// Initialize notification scheduler once after first successful DB connection
				initializeScheduler();
				schedulerInitialized = true;
			}
		})
		.catch(err => {
			console.error(`MongoDB connection failed (${err.code || 'UNKNOWN'}): ${err.message}. Retrying in ${MONGO_RETRY_MS / 1000}s...`);
			setTimeout(connectToMongo, MONGO_RETRY_MS);
		});
}

connectToMongo();

app.get('/api/health', (_req, res) => {
	res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/ai', require('./routes/ai'));

const DEFAULT_PORT = Number(process.env.PORT || process.env.port || 5000);
const server = http.createServer(app);

server.on('error', err => {
	console.error('Server startup error:', err);
	process.exit(1);
});

server.listen(DEFAULT_PORT, () => console.log(`Server running on port ${DEFAULT_PORT}`));
