const dotenv = require('dotenv');
dotenv.config();

const { initializeServer, verifyConfiguration } = require('./utils/serverInit');

initializeServer();
verifyConfiguration();

const initializeSharePointFolders = require('./utils/initializeFolders');
initializeSharePointFolders();

// ✅ Initialize local file storage
const { initializeStorageDirectories } = require('./utils/localFileStorage');

const express = require('express');
const http = require('http');
const path = require('path'); 
const fs = require('fs');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

// ✅ DIAGNOSTIC: Load routes with error handling
console.log('\n🔍 Loading route modules...');

const loadRoute = (routePath, routeName) => {
  try {
    const route = require(routePath);
    if (!route || typeof route !== 'function') {
      console.error(`❌ ${routeName}: Invalid export (not a function/router)`);
      console.error(`   Type: ${typeof route}`);
      console.error(`   Is Object: ${typeof route === 'object'}`);
      return null;
    }
    console.log(`✅ ${routeName}: Loaded successfully`);
    return route;
  } catch (error) {
    console.error(`❌ ${routeName}: Failed to load - ${error.message}`);
    return null;
  }
};

const authRoutes = loadRoute('./routes/authRoutes', 'authRoutes');
const pettyCashRoutes = loadRoute('./routes/pettyCashRoutes', 'pettyCashRoutes');
const cashRequestRoutes = loadRoute('./routes/cashRequestRoutes', 'cashRequestRoutes');
const invoiceRoutes = loadRoute('./routes/invoiceRoutes', 'invoiceRoutes');
const supplierRoutes = loadRoute('./routes/supplierInvoiceRoutes', 'supplierRoutes');
const purchaseRequisitionRoutes = loadRoute('./routes/purchaseRequisitionRoutes', 'purchaseRequisitionRoutes');
const vendorRoutes = loadRoute('./routes/vendorRoutes', 'vendorRoutes');
const incidentReportRoutes = loadRoute('./routes/incidentReportRoutes', 'incidentReportRoutes');
const budgetCodeRoutes = loadRoute('./routes/budgetCodeRoutes', 'budgetCodeRoutes');
const buyerRoutes = loadRoute('./routes/buyerRoutes', 'buyerRoutes');
const contractRoutes = loadRoute('./routes/contractRoutes', 'contractRoutes');
const itSupportRoutes = loadRoute('./routes/itSupportRoutes', 'itSupportRoutes');
const suggestionRoutes = loadRoute('./routes/suggestionRoutes', 'suggestionRoutes');
const leaveManagementRoutes = loadRoute('./routes/leaveManagementRoutes', 'leaveManagementRoutes');
const projectRoutes = loadRoute('./routes/projectRoutes', 'projectRoutes');
const supplierOnboardingRoutes = loadRoute('./routes/supplierOnboardingRoutes', 'supplierOnboardingRoutes');
const sharepointRoutes = loadRoute('./routes/sharepoint', 'sharepointRoutes');
const actionItemRoutes = loadRoute('./routes/actionItemRoutes', 'actionItemRoutes');
const communicationRoutes = loadRoute('./routes/communicationRoutes', 'communicationRoutes');
const quarterlyKPIRoutes = loadRoute('./routes/quarterlyKPIRoutes', 'quarterlyKPIRoutes');
const behavioralEvaluationRoutes = loadRoute('./routes/behavioralEvaluationRoutes', 'behavioralEvaluationRoutes');
const quarterlyEvaluationRoutes = loadRoute('./routes/quarterlyEvaluationRoutes', 'quarterlyEvaluationRoutes');
const inventoryRoutes = loadRoute('./routes/inventoryRoutes', 'inventoryRoutes');
const fixedAssetRoutes = loadRoute('./routes/fixedAssetRoutes', 'fixedAssetRoutes');
const supplierPerformanceRoutes = loadRoute('./routes/supplierPerformanceRoutes', 'supplierPerformanceRoutes');
const budgetTransferRoutes = loadRoute('./routes/budgetTransferRoutes', 'budgetTransferRoutes');
const enhancedUserRoutes = loadRoute('./routes/enhancedUserRoutes', 'enhancedUserRoutes');
const enhancedBehavioralRoutes = loadRoute('./routes/enhancedBehavioralEvaluationRoutes', 'enhancedBehavioralRoutes');
const scheduledReportRoutes = loadRoute('./routes/scheduledReportRoutes', 'scheduledReportRoutes');
const migrationRoutes = loadRoute('./routes/migrationRoutes', 'migrationRoutes');

console.log('✅ Route loading complete\n');

const { upload, handleMulterError } = require('./middlewares/uploadMiddleware');
const connectDB = require('./config/db');
const swaggerSpec = require('./swagger');
const socketService = require('./services/socketService');
const releaseStaleReservationsJob = require('./jobs/releaseStaleReservations');
const { initializeScheduledReports } = require('./services/scheduledReportService');
const { scheduleBudgetAlerts } = require('./services/budgetNotificationService');
const { initializeScheduledMessagesCron } = require('./utils/scheduledMessagesCron');
const cron = require('node-cron');

const app = express();

const server = http.createServer(app);
socketService.initialize(server);

connectDB();

initializeScheduledMessagesCron();

// CORS Configuration
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
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); 
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// ✅ UPDATED: Combined directory initialization function
const ensureUploadDirectories = async () => {
  console.log('\n🗂️  Initializing upload directories...');
  
  try {
    await initializeStorageDirectories();
    console.log('✅ Local file storage directories initialized');
    
    const legacyDirectories = [
      path.join(__dirname, 'uploads/temp'),
      path.join(__dirname, 'uploads/hr-documents'),
      path.join(__dirname, 'uploads/documents'),
      path.join(__dirname, 'uploads/employee-documents'),
      path.join(__dirname, 'uploads/it-support'),
      path.join(__dirname, 'uploads/pdfs'),
      path.join(__dirname, 'uploads/exports')
    ];

    console.log('\n🗂️  Ensuring legacy directories exist...');
    
    legacyDirectories.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
          console.log(`   ✅ Created: ${dir}`);
        } else {
          fs.accessSync(dir, fs.constants.W_OK);
          console.log(`   ✓ Exists: ${dir}`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to setup ${dir}:`, error.message);
      }
    });
    
    console.log('✅ All upload directories ready\n');
  } catch (error) {
    console.error('❌ Failed to initialize storage directories:', error);
  }
};

// Cron jobs
cron.schedule('0 8 * * *', async () => {
  try {
    console.log('=== RUNNING DAILY TASK REMINDERS ===');
    const User = require('./models/User');
    const ActionItem = require('./models/ActionItem');
    const { sendActionItemEmail } = require('./services/emailService');
    
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

cron.schedule('0 9 * * *', async () => {
  try {
    console.log('=== CHECKING OVERDUE TASKS ===');
    const ActionItem = require('./models/ActionItem');
    const { sendActionItemEmail } = require('./services/emailService');
    
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

// ✅ FIXED: Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif)$/i)) {
      res.setHeader('Content-Type', 'image/' + path.extname(filePath).substring(1));
    } else if (filePath.match(/\.(doc|docx)$/i)) {
      res.setHeader('Content-Type', 'application/msword');
    } else if (filePath.match(/\.(xls|xlsx)$/i)) {
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
    }
  }
}));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.files) {
    console.log('Files:', Object.keys(req.files));
  }
  next();
});

// ✅ SAFE ROUTE MOUNTING: Only mount routes that loaded successfully
console.log('\n🚀 Mounting API routes...');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec.specs));

if (authRoutes) app.use('/api/auth', authRoutes);
if (pettyCashRoutes) app.use('/api/petty-cash', pettyCashRoutes);
if (cashRequestRoutes) app.use('/api/cash-requests', cashRequestRoutes);
if (invoiceRoutes) app.use('/api/invoices', invoiceRoutes);
if (supplierRoutes) app.use('/api/suppliers', supplierRoutes);
if (purchaseRequisitionRoutes) app.use('/api/purchase-requisitions', purchaseRequisitionRoutes);
if (incidentReportRoutes) app.use('/api/incident-reports', incidentReportRoutes);

// Inline routes
try {
  app.use('/api/files', require('./routes/fileRoutes'));
  console.log('✅ Mounted: /api/files');
} catch (e) {
  console.error('❌ Failed to mount /api/files:', e.message);
}

try {
  app.use('/api/items', require('./routes/itemsRoutes'));
  console.log('✅ Mounted: /api/items');
} catch (e) {
  console.error('❌ Failed to mount /api/items:', e.message);
}

if (budgetCodeRoutes) app.use('/api/budget-codes', budgetCodeRoutes);
if (buyerRoutes) app.use('/api/buyer', buyerRoutes);
if (contractRoutes) app.use('/api/contracts', contractRoutes);
if (itSupportRoutes) app.use('/api/it-support', itSupportRoutes);
if (suggestionRoutes) app.use('/api/suggestions', suggestionRoutes);
if (leaveManagementRoutes) app.use('/api/leave', leaveManagementRoutes);
if (projectRoutes) app.use('/api/projects', projectRoutes);
if (supplierOnboardingRoutes) app.use('/api/supplier-onboarding', supplierOnboardingRoutes);
if (sharepointRoutes) app.use('/api/sharepoint', sharepointRoutes);
if (actionItemRoutes) app.use('/api/action-items', actionItemRoutes);
if (communicationRoutes) app.use('/api/communications', communicationRoutes);
if (quarterlyKPIRoutes) app.use('/api/kpis', quarterlyKPIRoutes);
if (behavioralEvaluationRoutes) app.use('/api/behavioral-evaluations', behavioralEvaluationRoutes);
if (quarterlyEvaluationRoutes) app.use('/api/quarterly-evaluations', quarterlyEvaluationRoutes);
if (inventoryRoutes) app.use('/api/inventory', inventoryRoutes);
if (fixedAssetRoutes) app.use('/api/fixed-assets', fixedAssetRoutes);
if (supplierPerformanceRoutes) app.use('/api/supplier-performance', supplierPerformanceRoutes);
if (enhancedUserRoutes) app.use('/api/enhanced-users', enhancedUserRoutes);
if (enhancedBehavioralRoutes) app.use('/api/enhanced-behavioral-evaluations', enhancedBehavioralRoutes);
if (migrationRoutes) app.use('/api/migration', migrationRoutes);
if (scheduledReportRoutes) app.use('/api/scheduled-reports', scheduledReportRoutes);
if (budgetTransferRoutes) app.use('/api/budget-transfers', budgetTransferRoutes);

try {
  app.use('/api/hr', require('./routes/hrRoutes'));
  console.log('✅ Mounted: /api/hr');
} catch (e) {
  console.error('❌ Failed to mount /api/hr:', e.message);
}

console.log('✅ Route mounting complete\n');

app.use(handleMulterError);

// Initialize directories
(async () => {
  try {
    await ensureUploadDirectories();
    console.log('✅ Server initialization complete');
  } catch (error) {
    console.error('❌ Server initialization error:', error);
  }
})();

releaseStaleReservationsJob.start();
scheduleBudgetAlerts();
initializeScheduledReports();

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
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
        fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.warn('Failed to cleanup file:', file.path, unlinkErr.message);
        });
      }
    });
  }
  
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

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n✅ Server started on port http://localhost:${PORT}`);
  console.log(`✅ Swagger UI available at http://localhost:${PORT}/api-docs\n`);
});







// const dotenv = require('dotenv');
// dotenv.config();

// const { initializeServer, verifyConfiguration } = require('./utils/serverInit');

// initializeServer();
// verifyConfiguration();

// const initializeSharePointFolders = require('./utils/initializeFolders');
// initializeSharePointFolders();


// const express = require('express');
// const http = require('http');
// const path = require('path'); 
// const fs = require('fs');
// const cors = require('cors');
// const swaggerUi = require('swagger-ui-express');
// const authRoutes = require('./routes/authRoutes');
// const pettyCashRoutes = require('./routes/pettyCashRoutes'); 
// const connectDB = require('./config/db');
// const swaggerSpec = require('./swagger');
// const socketService = require('./services/socketService');
// const cashRequestRoutes = require('./routes/cashRequestRoutes');
// const invoiceRoutes = require('./routes/invoiceRoutes');
// const { upload, handleMulterError } = require('./middlewares/uploadMiddleware'); 
// const supplierRoutes = require('./routes/supplierInvoiceRoutes');
// const purchaseRequisitionRoutes = require('./routes/purchaseRequisitionRoutes');
// const vendorRoutes = require('./routes/vendorRoutes');
// const incidentReportRoutes = require('./routes/incidentReportRoutes');
// const budgetCodeRoutes = require('./routes/budgetCodeRoutes');
// const buyerRoutes = require('./routes/buyerRoutes');
// const contractRoutes = require('./routes/contractRoutes');
// const itSupportRoutes = require('./routes/itSupportRoutes');
// const suggestionRoutes = require('./routes/suggestionRoutes');
// const leaveManagementRoutes = require('./routes/leaveManagementRoutes');
// const projectRoutes = require('./routes/projectRoutes');
// const supplierOnboardingRoutes = require('./routes/supplierOnboardingRoutes');
// const sharepointRoutes = require('./routes/sharepoint');
// const actionItemRoutes = require('./routes/actionItemRoutes');
// const communicationRoutes = require('./routes/communicationRoutes');
// const quarterlyKPIRoutes = require('./routes/quarterlyKPIRoutes');
// const behavioralEvaluationRoutes = require('./routes/behavioralEvaluationRoutes');
// const quarterlyEvaluationRoutes = require('./routes/quarterlyEvaluationRoutes');
// const inventoryRoutes = require('./routes/inventoryRoutes');
// const fixedAssetRoutes = require('./routes/fixedAssetRoutes');
// const supplierPerformanceRoutes = require('./routes/supplierPerformanceRoutes');
// const releaseStaleReservationsJob = require('./jobs/releaseStaleReservations');
// const budgetTransferRoutes = require('./routes/budgetTransferRoutes');
// const enhancedUserRoutes = require('./routes/enhancedUserRoutes');
// const enhancedBehavioralRoutes = require('./routes/enhancedBehavioralEvaluationRoutes');
// const { initializeScheduledReports } = require('./services/scheduledReportService');
// const scheduledReportRoutes = require('./routes/scheduledReportRoutes');
// const migrationRoutes = require('./routes/migrationRoutes');
// const { scheduleBudgetAlerts } = require('./services/budgetNotificationService');
// const { initializeScheduledMessagesCron } = require('./utils/scheduledMessagesCron');
// const cron = require('node-cron');


// const app = express();

// const server = http.createServer(app);
// socketService.initialize(server);

// connectDB();

// initializeScheduledMessagesCron();

// // CORS Configuration - Fixed
// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin) return callback(null, true);
    
//     const allowedOrigins = [
//       process.env.CLIENT_URL || 'http://localhost:3000',
//       'http://localhost:3001',
//       'http://127.0.0.1:3000',
//       'http://localhost:5173', 
//       'http://127.0.0.1:5173'
//     ];
    
//     console.log('Request origin:', origin);
//     console.log('CLIENT_URL from env:', process.env.CLIENT_URL);
    
//     if (allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       console.log('Blocked origin:', origin);
//       callback(null, true); 
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
//   preflightContinue: false,
//   optionsSuccessStatus: 200
// }));

// // Ensure all upload directories exist on startup
// const ensureUploadDirectories = () => {
//   const directories = [
//     // Base upload directory
//     path.join(__dirname, 'uploads'),
    
//     // Temp directory for multer
//     path.join(__dirname, 'uploads/temp'),
    
//     // Cash request attachments
//     path.join(__dirname, 'uploads/attachments'),
//     path.join(__dirname, 'uploads/justifications'),
//     path.join(__dirname, 'uploads/reimbursements'),
    
//     // HR documents
//     path.join(__dirname, 'uploads/hr-documents'),
//     path.join(__dirname, 'uploads/documents'),
//     path.join(__dirname, 'uploads/employee-documents'),
    
//     // IT Support
//     path.join(__dirname, 'uploads/it-support'),
    
//     // Other document types
//     path.join(__dirname, 'uploads/pdfs'),
//     path.join(__dirname, 'uploads/exports')
//   ];

//   console.log('\n🗂️  Ensuring upload directories exist...');
  
//   directories.forEach(dir => {
//     try {
//       if (!fs.existsSync(dir)) {
//         fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
//         console.log(`   ✅ Created: ${dir}`);
//       } else {
//         // Verify it's writable
//         fs.accessSync(dir, fs.constants.W_OK);
//         console.log(`   ✓ Exists: ${dir}`);
//       }
//     } catch (error) {
//       console.error(`   ❌ Failed to setup ${dir}:`, error.message);
//       // Don't exit - let the app try to continue
//     }
//   });
  
//   console.log('✅ Upload directories ready\n');
// };

// // Run daily at 8 AM to send task reminders
// cron.schedule('0 8 * * *', async () => {
//   try {
//     console.log('=== RUNNING DAILY TASK REMINDERS ===');
    
//     const users = await User.find({ isActive: true }).select('_id email fullName');
    
//     for (const user of users) {
//       const tasks = await ActionItem.find({
//         assignedTo: user._id,
//         status: { $nin: ['Completed'] }
//       }).sort({ dueDate: 1 });

//       if (tasks.length > 0) {
//         await sendActionItemEmail.dailyTaskSummary(
//           user.email,
//           user.fullName,
//           tasks
//         ).catch(err => console.error(`Failed to send summary to ${user.email}:`, err));
//       }
//     }

//     console.log('✅ Daily task reminders sent');
//   } catch (error) {
//     console.error('❌ Error in daily task reminders:', error);
//   }
// });

// // Run daily at 9 AM to check for overdue tasks
// cron.schedule('0 9 * * *', async () => {
//   try {
//     console.log('=== CHECKING OVERDUE TASKS ===');
    
//     const overdueTasks = await ActionItem.find({
//       status: { $nin: ['Completed'] },
//       dueDate: { $lt: new Date() }
//     }).populate('assignedTo', 'email fullName');

//     for (const task of overdueTasks) {
//       await sendActionItemEmail.taskOverdue(
//         task.assignedTo.email,
//         task.assignedTo.fullName,
//         task.title,
//         task.dueDate,
//         task._id
//       ).catch(err => console.error(`Failed to send overdue notification:`, err));
//     }

//     console.log(`✅ Sent ${overdueTasks.length} overdue notifications`);
//   } catch (error) {
//     console.error('❌ Error checking overdue tasks:', error);
//   }
// });

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// // Serve uploaded files statically
// app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
//   if (req.files) {
//     console.log('Files:', Object.keys(req.files));
//   }
//   next();
// });

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec.specs));
// app.use('/api/auth', authRoutes);
// app.use('/api/petty-cash', pettyCashRoutes); 
// app.use('/api/cash-requests', cashRequestRoutes);
// app.use('/api/invoices', invoiceRoutes);
// app.use('/api/suppliers', supplierRoutes);
// app.use('/api/purchase-requisitions', purchaseRequisitionRoutes);
// app.use('/api/incident-reports', incidentReportRoutes);
// app.use('/api/files', require('./routes/fileRoutes')); 
// app.use('/api/items', require('./routes/itemsRoutes'));
// app.use('/api/budget-codes', budgetCodeRoutes);
// app.use('/api/buyer', buyerRoutes);
// app.use('/api/contracts', contractRoutes);
// app.use('/api/it-support', itSupportRoutes);
// app.use('/api/suggestions', suggestionRoutes);
// app.use('/api/leave', leaveManagementRoutes);
// app.use('/api/projects', projectRoutes);
// app.use('/api/supplier-onboarding', supplierOnboardingRoutes);
// app.use('/api/sharepoint', sharepointRoutes);
// app.use('/api/action-items', actionItemRoutes);
// app.use('/api/communications', communicationRoutes);
// app.use('/api/kpis', quarterlyKPIRoutes);
// app.use('/api/behavioral-evaluations', behavioralEvaluationRoutes);
// app.use('/api/quarterly-evaluations', quarterlyEvaluationRoutes);
// app.use('/api/inventory', inventoryRoutes);
// app.use('/api/fixed-assets', fixedAssetRoutes);
// app.use('/api/supplier-performance', supplierPerformanceRoutes);
// app.use('/api/enhanced-users', enhancedUserRoutes);
// app.use('/api/behavioral-evaluations', enhancedBehavioralRoutes);
// app.use('/api/migration', migrationRoutes);
// app.use('/api/scheduled-reports', scheduledReportRoutes);
// app.use('/api/hr', require('./routes/hrRoutes')); 
// app.use('/api/budget-transfers', budgetTransferRoutes);

// app.use(handleMulterError);

// ensureUploadDirectories();

// releaseStaleReservationsJob.start();

// scheduleBudgetAlerts();

// initializeScheduledReports();

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error('Global error handler:', err);
  
//   // Clean up any temporary files on error
//   if (req.files) {
//     const cleanupFiles = [];
    
//     if (Array.isArray(req.files)) {
//       cleanupFiles.push(...req.files);
//     } else if (typeof req.files === 'object') {
//       Object.values(req.files).forEach(files => {
//         if (Array.isArray(files)) {
//           cleanupFiles.push(...files);
//         }
//       });
//     }
    
//     cleanupFiles.forEach(file => {
//       if (file.path) {
//         const fs = require('fs');
//         fs.unlink(file.path, (unlinkErr) => {
//           if (unlinkErr) console.warn('Failed to cleanup file:', file.path, unlinkErr.message);
//         });
//       }
//     });
//   }
  
//   // Handle specific error types
//   if (err.name === 'ValidationError') {
//     return res.status(400).json({
//       success: false,
//       message: 'Validation error',
//       errors: Object.values(err.errors).map(e => e.message)
//     });
//   }
  
//   if (err.name === 'CastError') {
//     return res.status(400).json({
//       success: false,
//       message: 'Invalid ID format'
//     });
//   }
  
//   if (err.code === 11000) {
//     return res.status(400).json({
//       success: false,
//       message: 'Duplicate entry detected'
//     });
//   }
  
//   // Default error response
//   res.status(err.status || 500).json({
//     success: false,
//     message: err.message || 'Internal server error',
//     ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
//   });
// });

// // 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Route not found'
//   });
// });

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (reason, promise) => {
//   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
// });

// // Handle uncaught exceptions
// process.on('uncaughtException', (error) => {
//   console.error('Uncaught Exception:', error);
//   process.exit(1);
// });

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server started on port http://localhost:${PORT}`);
//   console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
// });


