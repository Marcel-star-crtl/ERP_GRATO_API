const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const TaskMatchingService = require('../services/TaskMatchingService');
const TaskRecommendationService = require('../services/TaskRecommendationService');

router.use(authMiddleware);

router.post('/match', async (req, res) => {
    try {
        const task = req.body;
        const bestMatch = await TaskMatchingService.findBestMatch(task);
        
        if (!bestMatch) {
            return res.status(404).json({ message: 'No suitable tasker found' });
        }
        
        res.json({ 
            tasker: bestMatch,
            distance: TaskMatchingService.calculateDistance(
                task.location.coordinates[1],
                task.location.coordinates[0],
                bestMatch.currentLocation.coordinates[1],
                bestMatch.currentLocation.coordinates[0]
            )
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/recommend', async (req, res) => {
    try {
        const { task, limit } = req.body;
        const recommendations = await TaskRecommendationService.findBestMatches(task, limit);
        
        if (!recommendations || recommendations.length === 0) {
            return res.status(404).json({ message: 'No recommendations found' });
        }
        
        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;