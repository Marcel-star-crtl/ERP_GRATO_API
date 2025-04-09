const express = require('express');
const router = express.Router();
const Generator = require('../models/Generator');
const Tower = require('../models/Tower');
const Telemetry = require('../models/Telemetry');

// 1. Create Generator
router.post('/', async (req, res) => {
  try {
    // Verify tower exists
    const tower = await Tower.findById(req.body.tower_id);
    if (!tower) {
      return res.status(400).json({ error: 'Tower not found' });
    }

    // Create generator
    const generator = new Generator(req.body);
    await generator.save();

    // Add to tower's generators array
    await Tower.findByIdAndUpdate(
      req.body.tower_id,
      { $addToSet: { generators: generator._id } }
    );

    res.status(201).json(generator);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// Temporary test route
router.get('/test-save', async (req, res) => {
  const testData = {
    metadata: { generator_id: "GEN_ABJ_003", tower_id: "TOWER_ABC_001" },
    fuel_level: 50,
    power_output: 75.5,
    temperature: 65,
    status: "running",
    timestamp: new Date()
  };
  await new Telemetry(testData).save();
  res.json({ saved: true });
});


// Add this route to verify generator existence
router.get('/:id/verify', async (req, res) => {
  try {
    const generator = await Generator.findById(req.params.id).lean();
    if (!generator) {
      return res.status(404).json({ error: 'Generator not found' });
    }
    
    const telemetryCount = await Telemetry.countDocuments({
      'metadata.generator_id': req.params.id
    });
    
    res.json({
      generatorExists: true,
      telemetryRecords: telemetryCount,
      generatorStatus: generator.status,
      currentFuel: generator.current_stats.fuel
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// router.get('/:id', async (req, res) => {
//   try {
//     console.log("Looking up generator with ID:", req.params.id);
//     const generator = await Generator.findById(req.params.id);
//     console.log("Query result:", generator);
    
//     if (!generator) {
//       return res.status(404).json({ error: 'Generator not found' });
//     }
    
//     // Try populations separately
//     const withTower = await generator.populate('tower_id', 'name location');
//     console.log("After tower population:", withTower);
    
//     const withHistory = await withTower.populate('maintenance_history');
//     console.log("After maintenance population:", withHistory);
    
//     res.json(withHistory);
//   } catch (err) {
//     console.error("Error details:", err);
//     res.status(500).json({ error: err.message });
//   }
// });


// @desc    Get generator simulation data (last 24 hours)
// @route   GET /api/generators/:id/simulation
// @access  Public
// router.get('/:id/simulation', async (req, res) => {
//   try {
//     const telemetry = await Telemetry.find({
//       generator_id: req.params.id,
//       timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
//     })
//     .sort({ timestamp: 1 })
//     .select('timestamp fuel_level power_output temperature vibration status')
//     .lean();

//     res.json(telemetry);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


// In your telemetry routes
router.get('/:id/simulation', async (req, res) => {
  try {
    const now = new Date();
    const past = new Date(now - 2 * 60 * 1000); // Last 2 minutes only

    console.log('Querying recent data:', { 
      generatorId: req.params.id,
      from: past,
      to: now 
    });

    const telemetry = await Telemetry.find({
      'metadata.generator_id': req.params.id,
      timestamp: { $gte: past }
    }).sort({ timestamp: -1 });

    console.log(`Found ${telemetry.length} records`);
    res.json(telemetry);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// @desc    Get generator current simulation state
// @route   GET /api/generators/:id/simulation/current
// @access  Public
router.get('/:id/simulation/current', async (req, res) => {
  try {
    const telemetry = await Telemetry.findOne({
      generator_id: req.params.id
    })
    .sort({ timestamp: -1 })
    .select('fuel_level power_output temperature vibration status runtime shutdown_reason')
    .lean();

    if (!telemetry) {
      return res.status(404).json({ error: 'No simulation data found' });
    }

    res.json(telemetry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 1. Get All Generators (NEW)
router.get('/', async (req, res) => {
  try {
    const { status, tower, fuel_lt } = req.query;
    const filter = {};
    
    // Build filter based on query parameters
    if (status) filter.status = status;
    if (tower) filter.tower_id = tower;
    if (fuel_lt) filter['current_stats.fuel'] = { $lt: Number(fuel_lt) };

    const generators = await Generator.find(filter)
      .populate('tower_id', 'name location')
      .sort({ 'current_stats.fuel': 1 })
      .lean();

    res.json(generators);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 3. Update Generator Status
router.patch('/:id/status', async (req, res) => {
  try {
    const validStatuses = ['running', 'standby', 'fault', 'maintenance'];
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const generator = await Generator.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!generator) {
      return res.status(404).json({ error: 'Generator not found' });
    }

    res.json(generator);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Get Generator Telemetry
router.get('/:id/telemetry', async (req, res) => {
  try {
    const telemetry = await Telemetry.find({
      'metadata.generator_id': req.params.id
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

    res.json(telemetry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
