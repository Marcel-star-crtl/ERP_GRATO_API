// module.exports = (db) => {
//     const router = require('express').Router();
//     const towers = db.collection('towers');
//     const generators = db.collection('generators');
  
//     // 1. Create Tower
//     router.post('/', async (req, res) => {
//       try {
//         const result = await towers.insertOne(req.body);
//         res.status(201).json(result);
//       } catch (err) {
//         res.status(400).json({ error: err.message });
//       }
//     });
  
//     // 2. Get All Towers
//     router.get('/', async (req, res) => {
//       try {
//         const towerList = await towers.find({}).toArray();
//         res.json(towerList);
//       } catch (err) {
//         res.status(500).json({ error: err.message });
//       }
//     });
  
//     // 3. Get Single Tower with Stats
//     router.get('/:id', async (req, res) => {
//       try {
//         const tower = await towers.findOne({ _id: req.params.id });
//         if (!tower) return res.status(404).json({ error: 'Tower not found' });
  
//         // Get generators for this tower
//         const towerGenerators = await generators.find({ 
//           _id: { $in: tower.generators } 
//         }).toArray();
  
//         // Calculate stats
//         const stats = {
//           total_generators: towerGenerators.length,
//           active_generators: towerGenerators.filter(g => g.status).length,
//           avg_fuel: towerGenerators.reduce((sum, g) => sum + (g.current_stats?.fuel || 0), 0) / towerGenerators.length,
//           maintenance_due: towerGenerators.filter(g => {
//             return g.last_maintenance && 
//               new Date() - g.last_maintenance > 90 * 24 * 60 * 60 * 1000; // 90 days
//           }).length
//         };
  
//         res.json({ ...tower, stats, generators: towerGenerators });
//       } catch (err) {
//         res.status(500).json({ error: err.message });
//       }
//     });
  
//     // 4. Update Tower
//     router.put('/:id', async (req, res) => {
//       try {
//         const result = await towers.updateOne(
//           { _id: req.params.id },
//           { $set: req.body }
//         );
//         res.json(result);
//       } catch (err) {
//         res.status(400).json({ error: err.message });
//       }
//     });
  
//     return router;
//   };




const express = require('express');
const router = express.Router();
const Tower = require('../models/Tower');
const Generator = require('../models/Generator');

// @desc    Create a new tower
// @route   POST /api/towers
router.post('/', async (req, res) => {
  try {
    const tower = new Tower(req.body);
    await tower.save();
    res.status(201).json(tower);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// @desc    Get all towers
// @route   GET /api/towers
router.get('/', async (req, res) => {
  try {
    const towers = await Tower.find({});
    res.json(towers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// @desc    Get single tower with stats
// @route   GET /api/towers/:id
router.get('/:id', async (req, res) => {
  try {
    const tower = await Tower.findById(req.params.id);
    if (!tower) return res.status(404).json({ error: 'Tower not found' });

    const generators = await Generator.find({ 
      _id: { $in: tower.generators } 
    });

    const stats = {
      total_generators: generators.length,
      active_generators: generators.filter(g => g.status === 'running').length,
      avg_fuel: generators.reduce((sum, g) => sum + (g.current_stats?.fuel || 0), 0) / 
               (generators.length || 1),
      maintenance_due: generators.filter(g => {
        return g.last_maintenance && 
          new Date() - g.last_maintenance > 90 * 24 * 60 * 60 * 1000;
      }).length
    };

    res.json({ 
      ...tower.toObject(), 
      stats, 
      generators 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// @desc    Update tower
// @route   PUT /api/towers/:id
router.put('/:id', async (req, res) => {
  try {
    const tower = await Tower.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!tower) {
      return res.status(404).json({ error: 'Tower not found' });
    }
    
    res.json(tower);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;