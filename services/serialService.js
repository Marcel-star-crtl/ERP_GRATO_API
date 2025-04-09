const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const Telemetry = require('../models/Telemetry');
const Generator = require('../models/Generator');

class SerialService {
  constructor(io) {
    this.io = io;
    this.port = null;
    this.parser = null;
    this.lastDataReceived = null;
    this.reconnectAttempts = 0;
    this.MAX_RECONNECT_ATTEMPTS = 5;
  }

  async initialize() {
    try {
      // Close existing connection if any
      if (this.port?.isOpen) {
        await this.close();
      }

      const portPath = process.env.SERIAL_PORT || 'COM3';
      const baudRate = parseInt(process.env.SERIAL_BAUDRATE) || 9600;

      console.log(`Connecting to ${portPath} at ${baudRate} baud`);

      this.port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      this.port.on('open', () => {
        console.log(`Serial port ${portPath} opened successfully`);
        this.reconnectAttempts = 0;
        this.setupEventHandlers();
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

  async openPort() {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  setupEventHandlers() {
    this.parser.on('data', async (data) => {
      try {
        this.lastDataReceived = new Date();
        console.log(`[RAW DATA] ${data.trim()}`);
        await this.processData(data);
      } catch (err) {
        console.error('Data processing error:', err);
      }
    });
  }

  async processData(rawData) {
    const data = rawData.toString().trim();
    
    // Skip header/info lines
    if (data.startsWith("Advanced Generator") || 
        data.startsWith("Generator ID:") || 
        data.startsWith("FORMAT:")) {
      return;
    }
    
    // Expected format: GEN_ABJ_003,TOWER_ABC_001,fuel,power,temp,vib,status,runtime,shutdownReason
    const parts = data.split(',');
    
    if (parts.length !== 9) {
      throw new Error(`Invalid data format. Expected 9 values, got ${parts.length}`);
    }

    const [genId, towerId, fuel, power, temp, vib, status, runtime, shutdownReason] = parts;

    // Normalize shutdown reason
    const normalizedReason = this.normalizeShutdownReason(shutdownReason, status);

    const telemetryData = {
      metadata: {
        generator_id: genId,
        tower_id: towerId
      },
      fuel_level: this.validateNumber(fuel, 0, 100, 'fuel'),
      power_output: this.validateNumber(power, 0, 1000, 'power'),
      temperature: this.validateNumber(temp, -20, 120, 'temperature'),
      vibration: this.validateNumber(vib, 0, 100, 'vibration'),
      status: status.toLowerCase(), // 'running' or 'shutdown'
      runtime: parseInt(runtime),
      shutdown_reason: status.toLowerCase() === 'shutdown' ? normalizedReason : null,
      timestamp: new Date(),
      event_type: this.determineEventType(fuel, temp, vib, status, normalizedReason)
    };

    // Verify generator exists
    const generator = await Generator.findById(genId);
    if (!generator) throw new Error(`Generator ${genId} not found`);

    // Save to database
    const telemetry = new Telemetry(telemetryData);
    await telemetry.save();
    console.log(`Saved telemetry for ${genId}`);

    // Update generator status
    await Generator.findByIdAndUpdate(genId, {
      'current_stats.fuel': telemetryData.fuel_level,
      'current_stats.power': telemetryData.power_output,
      'current_stats.temp': telemetryData.temperature,
      'current_stats.runtime': telemetryData.runtime,
      status: telemetryData.status,
      last_updated: new Date()
    });

    // Emit real-time data
    if (this.io) {
      this.io.emit('telemetry', telemetry.toObject());
    }
  }

  validateNumber(value, min, max, field) {
    const num = parseFloat(value);
    if (isNaN(num)) throw new Error(`Invalid ${field}: ${value}`);
    if (num < min || num > max) throw new Error(`${field} out of range (${min}-${max})`);
    return num;
  }

  normalizeShutdownReason(reason, status) {
    if (status.toLowerCase() !== 'shutdown') return null;
    
    const reasonMap = {
      'low fuel': 'low_fuel',
      'overheating': 'overheating',
      'mechanical issue': 'mechanical_issue',
      'grid power restored': 'grid_power',
      'out of fuel': 'low_fuel',
      'none': null
    };
    
    return reasonMap[reason.toLowerCase()] || 'other';
  }

  determineEventType(fuel, temp, vib, status, shutdownReason) {
    const fuelLevel = parseFloat(fuel);
    const temperature = parseFloat(temp);
    const vibrationLevel = parseInt(vib);
    
    if (status.toLowerCase() !== 'running') {
      return shutdownReason === 'grid_power' ? 'grid_restored' : 'shutdown';
    }
    if (fuelLevel < 20) return 'low_fuel';
    if (temperature > 85) return 'overheating';
    if (vibrationLevel > 80) return 'mechanical_issue';
    return 'normal';
  }

  async reconnect() {
    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(5000 * this.reconnectAttempts, 30000);
    console.log(`Reconnecting in ${delay/1000} seconds...`);
    
    await this.close();
    setTimeout(() => this.initialize(), delay);
  }

  async close() {
    if (this.port?.isOpen) {
      await new Promise(resolve => this.port.close(resolve));
    }
  }
}

module.exports = SerialService;



// const { SerialPort } = require('serialport');
// const { ReadlineParser } = require('@serialport/parser-readline');
// const Telemetry = require('../models/Telemetry');
// const Generator = require('../models/Generator');

// class SerialService {
//   constructor(io) {
//     this.io = io;
//     this.port = null;
//     this.parser = null;
//     this.lastDataReceived = null;
//     this.reconnectAttempts = 0;
//     this.MAX_RECONNECT_ATTEMPTS = 5;
//   }

//   async initialize() {
//     try {
//       // Close existing connection if any
//       if (this.port?.isOpen) {
//         await this.close();
//       }

//       const portPath = process.env.SERIAL_PORT || 'COM3';
//       const baudRate = parseInt(process.env.SERIAL_BAUDRATE) || 9600;

//       console.log(`Connecting to ${portPath} at ${baudRate} baud`);

//       this.port = new SerialPort({
//         path: portPath,
//         baudRate: baudRate,
//         dataBits: 8,
//         parity: 'none',
//         stopBits: 1,
//         autoOpen: false
//       });

//       this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

//       this.port.on('open', () => {
//         console.log(`Serial port ${portPath} opened successfully`);
//         this.reconnectAttempts = 0;
//         this.setupEventHandlers();
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

//   async openPort() {
//     return new Promise((resolve, reject) => {
//       this.port.open((err) => {
//         if (err) return reject(err);
//         resolve();
//       });
//     });
//   }

//   setupEventHandlers() {
//     this.parser.on('data', async (data) => {
//       try {
//         this.lastDataReceived = new Date();
//         console.log(`[RAW DATA] ${data.trim()}`);
//         await this.processData(data);
//       } catch (err) {
//         console.error('Data processing error:', err);
//       }
//     });
//   }

//   async processData(rawData) {
//     const data = rawData.toString().trim();
    
//     // Expected format: GEN_ABJ_003,TOWER_ABC_001,fuel,power,temp,vib,status
//     const parts = data.split(',');
    
//     if (parts.length !== 7) {
//       throw new Error(`Invalid data format. Expected 7 values, got ${parts.length}`);
//     }

//     const [genId, towerId, fuel, power, temp, vib, status] = parts;

//     const telemetryData = {
//       metadata: {
//         generator_id: genId,
//         tower_id: towerId
//       },
//       fuel_level: this.validateNumber(fuel, 0, 100, 'fuel'),
//       power_output: this.validateNumber(power, 0, 1000, 'power'),
//       temperature: this.validateNumber(temp, -20, 120, 'temperature'),
//       vibration: this.validateNumber(vib, 0, 100, 'vibration'),
//       status: status === '1' ? 'running' : 'standby',
//       timestamp: new Date(),
//       event_type: this.determineEventType(fuel, temp, vib, status)
//     };

//     // Verify generator exists
//     const generator = await Generator.findById(genId);
//     if (!generator) throw new Error(`Generator ${genId} not found`);

//     // Save to database
//     const telemetry = new Telemetry(telemetryData);
//     await telemetry.save();
//     console.log(`Saved telemetry for ${genId}`);

//     // Update generator status
//     await Generator.findByIdAndUpdate(genId, {
//       'current_stats.fuel': telemetryData.fuel_level,
//       'current_stats.power': telemetryData.power_output,
//       'current_stats.temp': telemetryData.temperature,
//       status: telemetryData.status,
//       last_updated: new Date()
//     });

//     // Emit real-time data
//     if (this.io) {
//       this.io.emit('telemetry', telemetry.toObject());
//     }
//   }

//   validateNumber(value, min, max, field) {
//     const num = parseFloat(value);
//     if (isNaN(num)) throw new Error(`Invalid ${field}: ${value}`);
//     if (num < min || num > max) throw new Error(`${field} out of range (${min}-${max})`);
//     return num;
//   }

//   determineEventType(fuel, temp, vib, status) {
//     if (status !== '1') return 'shutdown';
//     if (fuel < 20) return 'low_fuel';
//     if (temp > 85) return 'overheating';
//     if (vib > 80) return 'mechanical_issue';
//     return 'normal';
//   }

//   async reconnect() {
//     this.reconnectAttempts++;
//     if (this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
//       console.error('Max reconnection attempts reached');
//       return;
//     }

//     const delay = Math.min(5000 * this.reconnectAttempts, 30000);
//     console.log(`Reconnecting in ${delay/1000} seconds...`);
    
//     await this.close();
//     setTimeout(() => this.initialize(), delay);
//   }

//   async close() {
//     if (this.port?.isOpen) {
//       await new Promise(resolve => this.port.close(resolve));
//     }
//   }
// }

// module.exports = SerialService;









// // After connecting to the Arduino/Proteus Simulation
// const { SerialPort } = require('serialport');
// const { Readline } = require('@serialport/parser-readline');
// const Telemetry = require('../models/Telemetry');
// const Alert = require('../models/Alert');
// const Generator = require('../models/Generator');
// const Tower = require('../models/Tower');

// class SerialService {
//   constructor(io) {
//     this.io = io;
//     this.port = null;
//     this.parser = null;
//   }

//   initialize() {
//     try {
//       this.port = new SerialPort({ 
//         path: process.env.SERIAL_PORT || 'COM3',
//         baudRate: 9600 
//       });

//       this.parser = this.port.pipe(new Readline({ delimiter: '\n' }));

//       this.port.on('open', () => {
//         console.log('Serial port connected to Proteus simulation');
//       });

//       this.port.on('error', (err) => {
//         console.error('Serial port error:', err);
//       });

//       this.parser.on('data', async (data) => {
//         try {
//           await this.processData(data);
//         } catch (error) {
//           console.error('Error processing serial data:', error);
//         }
//       });

//     } catch (error) {
//       console.error('Failed to initialize serial service:', error);
//     }
//   }

//   async processData(data) {
//     console.log('Received from Proteus:', data);
    
//     // Parse CSV data format: generatorId,towerId,fuelLevel,powerOutput,temperature,vibration,status
//     const [
//       generatorId, 
//       towerId,
//       fuelLevel, 
//       powerOutput, 
//       temperature, 
//       vibration, 
//       status
//     ] = data.trim().split(',').map(item => item.trim());

//     // Get generator and tower references
//     const generator = await Generator.findById(generatorId);
//     if (!generator) {
//       throw new Error(`Generator ${generatorId} not found`);
//     }

//     const tower = await Tower.findById(towerId);
//     if (!tower) {
//       throw new Error(`Tower ${towerId} not found`);
//     }

//     // Create telemetry record matching your schema
//     const telemetry = new Telemetry({
//       metadata: {
//         generator_id: generatorId,
//         tower_id: towerId
//       },
//       fuel_level: parseInt(fuelLevel),
//       power_output: parseFloat(powerOutput),
//       temperature: parseFloat(temperature),
//       vibration: parseInt(vibration),
//       status: status === '1' ? 'running' : 'standby',
//       event_type: this.determineEventType(
//         parseInt(fuelLevel),
//         parseFloat(temperature),
//         parseInt(vibration),
//         status
//       )
//     });

//     await telemetry.save();

//     // Update generator current stats
//     await Generator.findByIdAndUpdate(
//       generatorId,
//       {
//         'current_stats.fuel': parseInt(fuelLevel),
//         'current_stats.power': parseFloat(powerOutput),
//         'current_stats.temp': parseFloat(temperature),
//         status: status === '1' ? 'running' : 'standby'
//       }
//     );

//     // Emit real-time update via Socket.IO
//     if (this.io) {
//       this.io.emit('telemetry', telemetry);
//     }

//     // Create alerts if needed
//     await this.checkAlerts(telemetry);
//   }

//   determineEventType(fuelLevel, temperature, vibration, status) {
//     if (status !== '1') return 'shutdown';
//     if (fuelLevel < 20) return 'low_fuel';
//     if (temperature > 85) return 'overheating';
//     if (vibration > 80) return 'mechanical_issue';
//     return 'normal';
//   }

//   async checkAlerts(telemetry) {
//     if (telemetry.event_type === 'normal') return;

//     const alertTypeMap = {
//       'low_fuel': {
//         type: 'low_fuel',
//         severity: 'warning',
//         message: `Low fuel level: ${telemetry.fuel_level}%`
//       },
//       'overheating': {
//         type: 'overheating',
//         severity: 'critical',
//         message: `High temperature: ${telemetry.temperature}°C`
//       },
//       'mechanical_issue': {
//         type: 'mechanical_issue',
//         severity: 'critical',
//         message: `High vibration: ${telemetry.vibration}`
//       },
//       'shutdown': {
//         type: 'shutdown',
//         severity: 'info',
//         message: 'Generator shutdown detected'
//       }
//     };

//     const alertConfig = alertTypeMap[telemetry.event_type];
//     if (!alertConfig) return;

//     const existingAlert = await Alert.findOne({
//       'metadata.generator_id': telemetry.metadata.generator_id,
//       type: alertConfig.type,
//       resolved: false
//     });

//     if (!existingAlert) {
//       const alert = new Alert({
//         metadata: {
//           generator_id: telemetry.metadata.generator_id,
//           tower_id: telemetry.metadata.tower_id
//         },
//         type: alertConfig.type,
//         severity: alertConfig.severity,
//         message: alertConfig.message,
//         timestamp: telemetry.timestamp
//       });

//       await alert.save();

//       if (this.io) {
//         this.io.emit('alert', alert);
//       }
//     }
//   }
// }

// module.exports = SerialService;