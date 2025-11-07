const dotenv = require('dotenv');
dotenv.config();

const { initializeServer, verifyConfiguration } = require('./utils/serverInit');

initializeServer();
verifyConfiguration();

const initializeSharePointFolders = require('./utils/initializeFolders');
initializeSharePointFolders();


const express = require('express');
const http = require('http');
const path = require('path'); 
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const authRoutes = require('./routes/authRoutes');
const pettyCashRoutes = require('./routes/pettyCashRoutes'); 
const connectDB = require('./config/db');
const swaggerSpec = require('./swagger');
const socketService = require('./services/socketService');
const cashRequestRoutes = require('./routes/cashRequestRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const { upload, handleMulterError } = require('./middlewares/uploadMiddleware'); 
const supplierRoutes = require('./routes/supplierInvoiceRoutes');
const purchaseRequisitionRoutes = require('./routes/purchaseRequisitionRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const incidentReportRoutes = require('./routes/incidentReportRoutes');
const budgetCodeRoutes = require('./routes/budgetCodeRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const contractRoutes = require('./routes/contractRoutes');
const itSupportRoutes = require('./routes/itSupportRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes');
const leaveManagementRoutes = require('./routes/leaveManagementRoutes');
const projectRoutes = require('./routes/projectRoutes');
const supplierOnboardingRoutes = require('./routes/supplierOnboardingRoutes');
const sharepointRoutes = require('./routes/sharepoint');
const actionItemRoutes = require('./routes/actionItemRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const quarterlyKPIRoutes = require('./routes/quarterlyKPIRoutes');
const behavioralEvaluationRoutes = require('./routes/behavioralEvaluationRoutes');
const quarterlyEvaluationRoutes = require('./routes/quarterlyEvaluationRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const fixedAssetRoutes = require('./routes/fixedAssetRoutes');
const supplierPerformanceRoutes = require('./routes/supplierPerformanceRoutes');
const enhancedUserRoutes = require('./routes/enhancedUserRoutes');
const enhancedBehavioralRoutes = require('./routes/enhancedBehavioralEvaluationRoutes');
const migrationRoutes = require('./routes/migrationRoutes');
const { initializeScheduledMessagesCron } = require('./utils/scheduledMessagesCron');
const cron = require('node-cron');


const app = express();

const server = http.createServer(app);
socketService.initialize(server);

connectDB();

initializeScheduledMessagesCron();

// CORS Configuration - Fixed
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://localhost:5173', 
      'http://127.0.0.1:5173'
    ];
    
    console.log('Request origin:', origin);
    console.log('CLIENT_URL from env:', process.env.CLIENT_URL);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(null, true); 
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Run daily at 8 AM to send task reminders
cron.schedule('0 8 * * *', async () => {
  try {
    console.log('=== RUNNING DAILY TASK REMINDERS ===');
    
    const users = await User.find({ isActive: true }).select('_id email fullName');
    
    for (const user of users) {
      const tasks = await ActionItem.find({
        assignedTo: user._id,
        status: { $nin: ['Completed'] }
      }).sort({ dueDate: 1 });

      if (tasks.length > 0) {
        await sendActionItemEmail.dailyTaskSummary(
          user.email,
          user.fullName,
          tasks
        ).catch(err => console.error(`Failed to send summary to ${user.email}:`, err));
      }
    }

    console.log('✅ Daily task reminders sent');
  } catch (error) {
    console.error('❌ Error in daily task reminders:', error);
  }
});

// Run daily at 9 AM to check for overdue tasks
cron.schedule('0 9 * * *', async () => {
  try {
    console.log('=== CHECKING OVERDUE TASKS ===');
    
    const overdueTasks = await ActionItem.find({
      status: { $nin: ['Completed'] },
      dueDate: { $lt: new Date() }
    }).populate('assignedTo', 'email fullName');

    for (const task of overdueTasks) {
      await sendActionItemEmail.taskOverdue(
        task.assignedTo.email,
        task.assignedTo.fullName,
        task.title,
        task.dueDate,
        task._id
      ).catch(err => console.error(`Failed to send overdue notification:`, err));
    }

    console.log(`✅ Sent ${overdueTasks.length} overdue notifications`);
  } catch (error) {
    console.error('❌ Error checking overdue tasks:', error);
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.files) {
    console.log('Files:', Object.keys(req.files));
  }
  next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec.specs));
app.use('/api/auth', authRoutes);
app.use('/api/pettycash', pettyCashRoutes); 
app.use('/api/cash-requests', cashRequestRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-requisitions', purchaseRequisitionRoutes);
app.use('/api/incident-reports', incidentReportRoutes);
app.use('/api/files', require('./routes/files')); 
app.use('/api/items', require('./routes/itemsRoutes'));
app.use('/api/budget-codes', budgetCodeRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/it-support', itSupportRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/leave', leaveManagementRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/supplier-onboarding', supplierOnboardingRoutes);
app.use('/api/sharepoint', sharepointRoutes);
app.use('/api/action-items', actionItemRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/kpis', quarterlyKPIRoutes);
app.use('/api/behavioral-evaluations', behavioralEvaluationRoutes);
app.use('/api/quarterly-evaluations', quarterlyEvaluationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/fixed-assets', fixedAssetRoutes);
app.use('/api/supplier-performance', supplierPerformanceRoutes);
app.use('/api/enhanced-users', enhancedUserRoutes);
app.use('/api/behavioral-evaluations', enhancedBehavioralRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/hr', require('./routes/hrRoutes')); 

app.use(handleMulterError);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Clean up any temporary files on error
  if (req.files) {
    const cleanupFiles = [];
    
    if (Array.isArray(req.files)) {
      cleanupFiles.push(...req.files);
    } else if (typeof req.files === 'object') {
      Object.values(req.files).forEach(files => {
        if (Array.isArray(files)) {
          cleanupFiles.push(...files);
        }
      });
    }
    
    cleanupFiles.forEach(file => {
      if (file.path) {
        const fs = require('fs');
        fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.warn('Failed to cleanup file:', file.path, unlinkErr.message);
        });
      }
    });
  }
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry detected'
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server started on port http://localhost:${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});


