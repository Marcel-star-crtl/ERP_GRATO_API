// routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

const profileUpload = upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'identificationDocument', maxCount: 1 }
]);

router.use(authMiddleware);

router.put('/update', profileUpload, profileController.updateProfile);
router.get('/me', profileController.getProfile);
router.delete('/delete', profileController.deleteProfile);

// Doer-specific routes
// router.put('/doer/availability', 
//     requireRole('doer'),
//     profileController.updateAvailability
// );

module.exports = router;