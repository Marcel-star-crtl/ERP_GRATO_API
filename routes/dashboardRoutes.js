const express = require('express');
const router = express.Router();
const Generator = require('../models/Generator');
const Tower = require('../models/Tower');
const Telemetry = require('../models/Telemetry');

// Dashboard Statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total generators count
    const totalGenerators = await Generator.countDocuments();
    
    // Get active generators (running status)
    const activeGenerators = await Generator.countDocuments({ status: 'running' });
    
    // Get generators with active alerts
    // Assuming there's an 'alerts' field in the schema that indicates issues
    const activeAlerts = await Generator.countDocuments({
      $or: [
        { status: 'fault' },
        { 'current_stats.fuel': { $lt: 20 } }, // Low fuel alert (less than 20%)
        { alerts: { $exists: true, $ne: [] } } // Any generators with non-empty alerts array
      ]
    });
    
    // Get maintenance due count
    // Assuming maintenance due is determined by 'next_maintenance_date' being before current date
    const currentDate = new Date();
    const maintenanceDue = await Generator.countDocuments({
      $or: [
        { next_maintenance_date: { $lte: currentDate } },
        { 'current_stats.runtime_hours': { $gte: 1000 } } // Or runtime hours exceed threshold
      ]
    });
    
    // Get generator status distribution for pie chart
    const statusDistribution = await Generator.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    
    // Get fuel levels overview for the fuel chart
    const fuelLevels = await Generator.aggregate([
      { 
        $project: {
          fuel_level: '$current_stats.fuel',
          name: 1,
          tower_id: 1
        }
      },
      {
        $lookup: {
          from: 'towers',
          localField: 'tower_id',
          foreignField: '_id',
          as: 'tower'
        }
      },
      {
        $project: {
          name: 1,
          fuel_level: 1,
          tower_name: { $arrayElemAt: ['$tower.name', 0] }
        }
      },
      { $sort: { fuel_level: 1 } },
      { $limit: 10 } // Get 10 generators with lowest fuel levels
    ]);
    
    // Compile all stats in one response object
    const dashboardStats = {
      total_generators: totalGenerators,
      active_generators: activeGenerators,
      active_alerts: activeAlerts,
      maintenance_due: maintenanceDue,
      status_distribution: statusDistribution,
      fuel_levels: fuelLevels
    };
    
    res.json(dashboardStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;