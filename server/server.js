// Load environment variables first!
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// IMPORT ROUTES
const authRoutes = require('./routes/auth');
const budgetRoutes = require('./routes/budget');
const estateRoutes = require('./routes/estate');
const goalsRoutes = require('./routes/goals');
const investmentsRoutes = require('./routes/investments');
const payoutsRoutes = require('./routes/payouts');
const taxRoutes = require('./routes/tax');
const tradesRoutes = require('./routes/trades');

// IMPORT MIDDLEWARE
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://1wealthblend.com',
      'https://www.1wealthblend.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000'
    ];
    
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:8000');
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '1WealthBlend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/estate', estateRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/payouts', payoutsRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/trades', tradesRoutes);

// Serve static files from client build (if exists)
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuildPath));
  
  // Catch all handler for React Router
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        success: false,
        error: { message: 'API endpoint not found' }
      });
    }
    
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  // Development - serve a simple landing page
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Welcome to 1WealthBlend API',
      version: '1.0.0',
      documentation: '/api/docs',
      endpoints: {
        auth: '/api/auth',
        budget: '/api/budget',
        estate: '/api/estate',
        goals: '/api/goals',
        investments: '/api/investments',
        payouts: '/api/payouts',
        tax: '/api/tax',
        trades: '/api/trades'
      }
    });
  });
}

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'API endpoint not found',
      path: req.path,
      method: req.method
    }
  });
});

// Global error handling middleware (must be last)
app.use(errorHandler);

// Database connection and server startup
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/1wealthblend';
    
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Connected to MongoDB successfully');
    
    // Start server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 1WealthBlend server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`📱 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.NODE_ENV === 'production') {
        console.log(`🌐 Production URL: https://${process.env.DOMAIN || '1wealthblend.com'}`);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Process terminated');
        mongoose.connection.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received. Shutting down gracefully...');
      server.close(() => {
        console.log('Process terminated');
        mongoose.connection.close();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Start the application
connectDB();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;
