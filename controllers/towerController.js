const Tower = require('../models/Tower');
const Generator = require('../models/Generator');
const { validateCoordinates } = require('../utils/validators');

// @desc    Get all towers
// @route   GET /api/towers
// @access  Public
exports.getAllTowers = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    
    const towers = await Tower.find(filter)
      .populate({
        path: 'generators',
        select: '_id model status current_stats.fuel'
      })
      .lean();

    // Calculate stats for each tower
    const towersWithStats = towers.map(tower => {
      const stats = {
        total_generators: tower.generators.length,
        active_generators: tower.generators.filter(g => g.status === 'running').length,
        avg_fuel: tower.generators.reduce((sum, g) => sum + g.current_stats.fuel, 0) / 
                 (tower.generators.length || 1),
        maintenance_due: tower.generators.filter(g => 
          !g.last_maintenance || 
          new Date() - g.last_maintenance > 90 * 24 * 60 * 60 * 1000
        ).length
      };
      return { ...tower, stats };
    });

    res.json(towersWithStats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get single tower
// @route   GET /api/towers/:id
// @access  Public
exports.getTower = async (req, res) => {
  try {
    const tower = await Tower.findById(req.params.id)
      .populate({
        path: 'generators',
        select: '_id model status current_stats installation_date last_maintenance'
      })
      .lean();

    if (!tower) {
      return res.status(404).json({ error: 'Tower not found' });
    }

    // Calculate detailed stats
    const stats = {
      total_generators: tower.generators.length,
      active_generators: tower.generators.filter(g => g.status === 'running').length,
      avg_fuel: tower.generators.reduce((sum, g) => sum + g.current_stats.fuel, 0) / 
               (tower.generators.length || 1),
      avg_temp: tower.generators.reduce((sum, g) => sum + g.current_stats.temp, 0) / 
               (tower.generators.length || 1),
      maintenance_due: tower.generators.filter(g => 
        !g.last_maintenance || 
        new Date() - g.last_maintenance > 90 * 24 * 60 * 60 * 1000
      ).length
    };

    res.json({ ...tower, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Create tower
// @route   POST /api/towers
// @access  Private/Admin
exports.createTower = async (req, res) => {
  try {
    const { _id, name, address } = req.body;

    // Basic validation
    if (!_id || !name || !address) {
      return res.status(400).json({ 
        error: '_id, name and location are required',
        valid_id_format: 'Must match pattern: TOWER_XXX_999 (3 uppercase letters, 3 numbers)'
      });
    }

    if (typeof location !== 'string') {
      return res.status(400).json({ error: 'Location must be a text string' });
    }

    // Create the tower
    const tower = new Tower({
      _id: _id,
      name: name.trim(),
      address: address.trim(),
      status: req.body.status || 'inactive',
      generators: req.body.generators || []
    });

    await tower.save();
    res.status(201).json(tower);
    
  } catch (err) {
    if (err.name === 'ValidationError') {
      // More detailed error message for _id validation
      if (err.errors?._id) {
        return res.status(400).json({ 
          error: 'Invalid tower ID format',
          details: err.errors._id.message,
          valid_format: 'TOWER_ABC_123 (3 uppercase letters, 3 numbers)'
        });
      }
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ error: messages });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
// exports.createTower = async (req, res) => {
//   try {
//     const { location, ...rest } = req.body;

//     if (!validateCoordinates(location.gps)) {
//       return res.status(400).json({ error: 'Invalid GPS coordinates' });
//     }

//     const tower = new Tower({
//       ...rest,
//       location: {
//         ...location,
//         gps: {
//           type: 'Point',
//           coordinates: location.gps
//         }
//       }
//     });

//     await tower.save();
//     res.status(201).json(tower);
//   } catch (err) {
//     if (err.name === 'ValidationError') {
//       const messages = Object.values(err.errors).map(val => val.message);
//       return res.status(400).json({ error: messages });
//     }
//     console.error(err);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

// @desc    Update tower
// @route   PUT /api/towers/:id
// @access  Private/Admin
exports.updateTower = async (req, res) => {
  try {
    const { name, location, status, generators } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (location) {
      if (typeof location !== 'string') {
        return res.status(400).json({ error: 'Location must be a text string' });
      }
      updates.location = location.trim();
    }
    if (status) updates.status = status;
    if (generators) updates.generators = generators;

    const tower = await Tower.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!tower) {
      return res.status(404).json({ error: 'Tower not found' });
    }

    res.json(tower);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ error: messages });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete tower
// @route   DELETE /api/towers/:id
// @access  Private/Admin
exports.deleteTower = async (req, res) => {
  try {
    const tower = await Tower.findById(req.params.id);

    if (!tower) {
      return res.status(404).json({ error: 'Tower not found' });
    }

    // Check if tower has generators
    if (tower.generators.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete tower with assigned generators' 
      });
    }

    await tower.remove();
    res.json({ message: 'Tower removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};