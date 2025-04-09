const express = require('express');
const router = express.Router();
const SimulationController = require('../controllers/simulationController');

// Start/stop simulation
router.post('/:generatorId/start', SimulationController.startSimulation);
router.post('/:generatorId/stop', SimulationController.stopSimulation);

// Get simulation data
router.get('/:generatorId/telemetry', SimulationController.getSimulatedTelemetry);

// Control simulation
router.put('/:generatorId/params', SimulationController.updateSimulationParams);
router.post('/speed', SimulationController.setSimulationSpeed);
router.post('/trigger-event', SimulationController.triggerSimulationEvent);

// Get simulation status
router.get('/status', SimulationController.getSimulationStatus);

module.exports = router;