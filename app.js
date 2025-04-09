// const dotenv = require('dotenv');
// dotenv.config();

// const express = require('express');
// const http = require('http');
// const cors = require('cors');
// const swaggerUi = require('swagger-ui-express');
// const authRoutes = require('./routes/authRoutes');
// const profileRoutes = require('./routes/profileRoutes');
// const taskRoutes = require('./routes/taskRoutes');
// const notificationsRoutes = require('./routes/notificationRoutes');
// const recommendationRoutes = require('./routes/recommendationRoutes');
// const generatorRoutes = require('./routes/generatorRoutes');
// const maintenanceRoutes = require('./routes/maintenanceRoutes');
// const telemetryRoutes = require('./routes/telemetryRoutes');
// const towerRoutes = require('./routes/towerRoutes');
// const connectDB = require('./config/db');
// const swaggerSpec = require('./swagger');
// const socketService = require('./services/socketService');
// const { initializeFirebase } = require('./config/firebase');
// const SerialService = require('./services/serialService');
// const dashboardRoutes = require('./routes/dashboardRoutes');
// const simulationdashboardRoutes = require('./routes/simulationDashboardRoutes');


// initializeFirebase();

// const app = express();

// // Payment Routes
// const paymentRoutes = require('./routes/paymentRoutes');

// const server = http.createServer(app);
// socketService.initialize(server);

// // After socketService initialization
// const serialService = new SerialService(socketService.io);
// serialService.initialize();

// // After creating the serialService instance
// app.locals.serialService = serialService;

// connectDB();

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec.specs));
// app.use('/api/auth', authRoutes);
// app.use('/api/profile', profileRoutes);
// app.use('/api/tasks', taskRoutes);
// app.use('/api/notifications', notificationsRoutes);
// app.use('/api/task', taskRoutes)
// app.use('/api/recommendations', recommendationRoutes)
// app.use('/api/payments', paymentRoutes);
// app.use('/api/generators', generatorRoutes);
// app.use('/api/maintenance', maintenanceRoutes);
// app.use('/api/towers', towerRoutes)
// app.use('/api/telemetry', telemetryRoutes)
// app.use('/api', dashboardRoutes);
// // app.use('/api/simulation', simulationdashboardRoutes);


// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server started on port http://localhost:${PORT}`);
//   console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
// });










// const dotenv = require('dotenv');
// dotenv.config();
// const express = require('express');
// const http = require('http');
// const cors = require('cors');
// const { SerialPort } = require('serialport');
// const { ReadlineParser } = require('@serialport/parser-readline');
// const mongoose = require('mongoose');


// // Initialize Express
// const app = express();
// const server = http.createServer(app);

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Database Connection
// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('MongoDB connected'))
//   .catch(err => console.error('MongoDB connection error:', err));

// // Enhanced Serial Service Class
// class SerialService {
//   constructor() {
//     this.port = null;
//     this.parser = null;
//     this.lastData = {
//       raw: null,
//       parsed: null,
//       timestamp: null
//     };
//     this.rawDataBuffer = [];
//   }

//   async initialize() {
//     try {
//       await this.close();

//       console.log(`Initializing serial on ${process.env.SERIAL_PORT} at ${process.env.SERIAL_BAUDRATE || 9600} baud`);

//       this.port = new SerialPort({
//         path: process.env.SERIAL_PORT || 'COM1',
//         baudRate: parseInt(process.env.SERIAL_BAUDRATE) || 9600,
//         dataBits: 8,
//         parity: 'none',
//         stopBits: 1,
//         autoOpen: false
//       });

//       this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

//       this.port.on('open', () => {
//         console.log(`Serial port ${this.port.path} opened successfully`);
//         this.setupDataHandlers();
//       });

//       this.port.on('error', (err) => {
//         console.error('Serial port error:', err);
//         this.reconnect();
//       });

//       await this.openPort();

//     } catch (err) {
//       console.error('Serial initialization error:', err);
//       this.reconnect();
//     }
//   }


//   setupDataHandlers() {
//     this.parser.on('data', async (data) => {
//       try {
//         const strData = data.toString().trim();
//         console.log(`[RAW] ${strData}`);
        
//         // Store raw data for debugging
//         this.rawDataBuffer.push(strData);
//         if (this.rawDataBuffer.length > 10) this.rawDataBuffer.shift();
        
//         this.lastData = {
//           raw: strData,
//           timestamp: new Date()
//         };

//         // Skip debug/empty lines
//         if (!strData || strData.startsWith("PROTEUS") || strData.startsWith("DEBUG")) {
//           return;
//         }

//         await this.processData(strData);
//       } catch (err) {
//         console.error('Data handler error:', err);
//       }
//     });
//   }


//   async processData(data) {
//     try {
//       const parts = data.split(',');
//       if (parts.length !== 8) { 
//         throw new Error(`Invalid data format. Expected 8 values, got ${parts.length}`);
//       }
  
//       const [genId, fuel, power, temp, vib, status, runtime, shutdownReason] = parts;
  
//       const telemetry = {
//         metadata: {
//           generator_id: genId,
//           tower_id: 'UNKNOWN_TOWER' 
//         },
//         fuel_level: parseFloat(fuel),
//         power_output: parseFloat(power),
//         temperature: parseFloat(temp),
//         vibration: parseInt(vib),
//         status: status === '1' ? 'running' : 'standby',
//         timestamp: new Date(),
//         event_type: this.determineEventType(fuel, temp, vib, status),
//         runtime: parseInt(runtime),
//         shutdown_reason: shutdownReason
//       };

//       // Save to database
//       const Telemetry = require('./models/Telemetry');
//       await Telemetry.create(telemetry);
//       console.log(`Saved telemetry for ${genId}`);

//       // Save raw data for debugging
//       const SerialData = require('./models/SerialData');
//       await SerialData.create({ rawData: data });

//       this.lastData.parsed = telemetry;

//     } catch (err) {
//       console.error('Data processing error:', err);
//     }
//   }

//   determineEventType(fuel, temp, vib, status) {
//     if (status !== '1') return 'shutdown';
//     if (fuel < 20) return 'low_fuel';
//     if (temp > 85) return 'overheating';
//     if (vib > 80) return 'mechanical_issue';
//     return 'normal';
//   }


//   async openPort() {
//     return new Promise((resolve, reject) => {
//       this.port.open((err) => {
//         if (err) return reject(err);
//         resolve();
//       });
//     });
//   }

//   async sendToPort(message) {
//     return new Promise((resolve, reject) => {
//       if (!this.port?.isOpen) {
//         return reject(new Error('Port not open'));
//       }
//       this.port.write(message + '\n', (err) => {
//         if (err) return reject(err);
//         console.log('Sent to port:', message);
//         resolve();
//       });
//     });
//   }

//   reconnect() {
//     setTimeout(() => {
//       console.log('Attempting to reconnect...');
//       this.initialize();
//     }, 5000);
//   }

//   async close() {
//     if (this.port?.isOpen) {
//       await new Promise(resolve => this.port.close(resolve));
//     }
//   }

//   getStatus() {
//     return {
//       isConnected: this.port?.isOpen || false,
//       lastDataReceived: this.lastData.timestamp || 'Never',
//       portPath: this.port?.path || 'Not connected',
//       lastRawData: this.lastData.raw || 'None'
//     };
//   }
// }

// // Initialize Serial Service
// const serialService = new SerialService();
// app.locals.serialService = serialService;
// serialService.initialize();

// // Routes
// app.use('/api/telemetry', require('./routes/telemetryRoutes'));
// // ... other routes ...

// // Health Check Endpoint
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'OK',
//     mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
//     serial: serialService.port?.isOpen ? 'connected' : 'disconnected',
//     port: process.env.SERIAL_PORT || 'not configured'
//   });
// });

// // Start Server
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
//   console.log(`Using serial port: ${process.env.SERIAL_PORT || 'COM1'}`);
// });






const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notificationsRoutes = require('./routes/notificationRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const generatorRoutes = require('./routes/generatorRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const towerRoutes = require('./routes/towerRoutes');
const connectDB = require('./config/db');
const swaggerSpec = require('./swagger');
const socketService = require('./services/socketService');
const { initializeFirebase } = require('./config/firebase');
const dashboardRoutes = require('./routes/dashboardRoutes');
const simulationdashboardRoutes = require('./routes/simulationDashboardRoutes');


// Initialize Express
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Enhanced Serial Service Class
class SerialService {
  constructor() {
    this.port = null;
    this.parser = null;
    this.lastData = {
      raw: null,
      parsed: null,
      timestamp: null
    };
    this.rawDataBuffer = [];
  }

  async initialize() {
    try {
      await this.close();

      console.log(`Initializing serial on ${process.env.SERIAL_PORT} at ${process.env.SERIAL_BAUDRATE || 9600} baud`);

      this.port = new SerialPort({
        path: process.env.SERIAL_PORT || 'COM1',
        baudRate: parseInt(process.env.SERIAL_BAUDRATE) || 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      this.port.on('open', () => {
        console.log(`Serial port ${this.port.path} opened successfully`);
        this.setupDataHandlers();
      });

      this.port.on('error', (err) => {
        console.error('Serial port error:', err);
        this.reconnect();
      });

      await this.openPort();

    } catch (err) {
      console.error('Serial initialization error:', err);
      this.reconnect();
    }
  }


  setupDataHandlers() {
    this.parser.on('data', async (data) => {
      try {
        const strData = data.toString().trim();
        console.log(`[RAW] ${strData}`);
        
        // Store raw data for debugging
        this.rawDataBuffer.push(strData);
        if (this.rawDataBuffer.length > 10) this.rawDataBuffer.shift();
        
        this.lastData = {
          raw: strData,
          timestamp: new Date()
        };

        // Skip debug/empty lines
        if (!strData || strData.startsWith("PROTEUS") || strData.startsWith("DEBUG")) {
          return;
        }

        await this.processData(strData);
      } catch (err) {
        console.error('Data handler error:', err);
      }
    });
  }


  async processData(data) {
    try {
      const parts = data.split(',');
      if (parts.length !== 9) { 
        throw new Error(`Invalid data format. Expected 8 values, got ${parts.length}`);
      }
  
      const [genId, towerId, fuel, power, temp, vib, status, runtime, shutdownReason] = parts;
  
      const telemetry = {
        metadata: {
          generator_id: genId,
          tower_id: towerId 
        },
        fuel_level: parseFloat(fuel),
        power_output: parseFloat(power),
        temperature: parseFloat(temp),
        vibration: parseInt(vib),
        status: status === '1' ? 'running' : 'standby',
        timestamp: new Date(),
        event_type: this.determineEventType(fuel, temp, vib, status),
        runtime: parseInt(runtime),
        shutdown_reason: shutdownReason
      };

      // Save to database
      const Telemetry = require('./models/Telemetry');
      await Telemetry.create(telemetry);
      console.log(`Saved telemetry for ${genId}`);

      // Save raw data for debugging
      const SerialData = require('./models/SerialData');
      await SerialData.create({ rawData: data });

      this.lastData.parsed = telemetry;

    } catch (err) {
      console.error('Data processing error:', err);
    }
  }

  determineEventType(fuel, temp, vib, status) {
    if (status !== '1') return 'shutdown';
    if (fuel < 20) return 'low_fuel';
    if (temp > 85) return 'overheating';
    if (vib > 80) return 'mechanical_issue';
    return 'normal';
  }


  async openPort() {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async sendToPort(message) {
    return new Promise((resolve, reject) => {
      if (!this.port?.isOpen) {
        return reject(new Error('Port not open'));
      }
      this.port.write(message + '\n', (err) => {
        if (err) return reject(err);
        console.log('Sent to port:', message);
        resolve();
      });
    });
  }

  reconnect() {
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.initialize();
    }, 5000);
  }

  async close() {
    if (this.port?.isOpen) {
      await new Promise(resolve => this.port.close(resolve));
    }
  }

  getStatus() {
    return {
      isConnected: this.port?.isOpen || false,
      lastDataReceived: this.lastData.timestamp || 'Never',
      portPath: this.port?.path || 'Not connected',
      lastRawData: this.lastData.raw || 'None'
    };
  }
}

// Initialize Serial Service
const serialService = new SerialService();
app.locals.serialService = serialService;
serialService.initialize();

// Routes
app.use('/api/telemetry', require('./routes/telemetryRoutes'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec.specs));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/task', taskRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/generators', generatorRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/towers', towerRoutes)
app.use('/api/telemetry', telemetryRoutes)
app.use('/api', dashboardRoutes);
// app.use('/api/simulation', simulationdashboardRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    serial: serialService.port?.isOpen ? 'connected' : 'disconnected',
    port: process.env.SERIAL_PORT || 'not configured'
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Using serial port: ${process.env.SERIAL_PORT || 'COM1'}`);
});