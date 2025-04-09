const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const notificationController = require('../controllers/notificationController');
const pushNotificationService = require('../services/pushNotificationService');
const { admin } = require('../config/firebase');

// Test endpoints for notifications
router.post('/test/socket', authMiddleware, async (req, res) => {
  try {
    const socketService = require('../services/socketService');
    const { userId, event, data } = req.body;
    
    socketService.emitToUser(userId, event, data);
    
    res.status(200).json({
      success: true,
      message: 'Socket notification sent'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/test/push', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const notification = {
      title: 'Test Notification',
      body: 'This is a test notification',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    };

    const result = await pushNotificationService.sendToUser(userId, notification);
    res.status(200).json({
      success: true,
      message: 'Test notification sent',
      result
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/test/both', authMiddleware, async (req, res) => {
  try {
    const socketService = require('../services/socketService');
    const pushService = require('../services/pushNotificationService');
    const { userId, event, notification } = req.body;
    
    // Send both socket and push notifications
    socketService.emitToUser(userId, event, notification.data);
    await pushService.sendToUser(userId, notification);
    
    res.status(200).json({
      success: true,
      message: 'Both notifications sent'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// Register FCM token
router.post('/register-token', authMiddleware, async (req, res) => {
  try {
    const { token, device, platform } = req.body;
    const userId = req.user._id;

    if (!token || !device || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Token, device, and platform are required'
      });
    }

    await pushNotificationService.registerToken(userId, token, device, platform);

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully'
    });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});



// router.post('/test-fcm', async (req, res) => {
//   try {
//     const message = {
//       notification: {
//         title: 'Test Title',
//         body: 'Test body message'
//       },
//       topic: 'test' // Using topic instead of token for testing
//     };

//     const response = await admin.messaging().send(message);
//     console.log('Successfully sent message:', response);
    
//     res.status(200).json({
//       success: true,
//       messageId: response
//     });
//   } catch (error) {
//     console.error('Error sending message:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

router.delete('/remove-token', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user._id;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    await pushNotificationService.removeToken(userId, token);

    res.status(200).json({
      success: true,
      message: 'FCM token removed successfully'
    });
  } catch (error) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Main notification endpoints
router.get('/', authMiddleware, notificationController.getUnreadNotifications);
router.put('/:notificationId/read', authMiddleware, notificationController.markNotificationAsRead);
router.delete('/:notificationId', authMiddleware, notificationController.deleteNotification);

module.exports = router;