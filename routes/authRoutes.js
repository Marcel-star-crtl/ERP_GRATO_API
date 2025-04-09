const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const User = require('../models/User');

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/verify-phone', authController.verifyPhone);

// Get all users with filtering and pagination
router.get('/users', authMiddleware, requireRoles('admin'), async (req, res) => {
    try {
        const { role, page = 1, limit = 10, verificationStatus } = req.query;
        
        // Build query object
        let query = {};
        if (role) {
            query.role = role;
        }
        
        // Add verification status filtering
        if (verificationStatus === 'verified') {
            query.$or = [
                { emailVerified: true },
                { phoneVerified: true }
            ];
        } else if (verificationStatus === 'unverified') {
            query.$and = [
                { emailVerified: false },
                { phoneVerified: false }
            ];
        }

        const users = await User
            .find(query)
            .select('-password -emailVerificationToken -phoneVerificationToken')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const totalUsers = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                users,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: parseInt(page),
                totalUsers
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
});

// Get specific user
router.get('/users/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User
            .findById(userId)
            .select('-password -emailVerificationToken -phoneVerificationToken');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check permissions
        if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.status(200).json({
            success: true,
            data: { user }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: error.message
        });
    }
});

// Search users
router.get('/users/search', authMiddleware, requireRoles('admin'), async (req, res) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;

        const searchQuery = {
            $or: [
                { fullName: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } }
            ]
        };

        const users = await User
            .find(searchQuery)
            .select('-password -emailVerificationToken -phoneVerificationToken')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const count = await User.countDocuments(searchQuery);

        res.status(200).json({
            success: true,
            data: {
                users,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page),
                totalUsers: count
            }
        });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search users',
            error: error.message
        });
    }
});

// Protected routes example
router.get('/protected', authMiddleware, (req, res) => {
    res.json({ success: true, user: req.user });
});

// Role-specific route example
router.get('/doer-only', authMiddleware, requireRoles('doer'), (req, res) => {
    res.json({ success: true, message: 'Doer access granted' });
});

module.exports = router;