const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware for authentication
 * Verifies JWT token and checks if the user exists in the database
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Check for `x-auth-token` first
        let token = req.header('x-auth-token');

        // If no `x-auth-token`, check for Bearer token in the Authorization header
        if (!token) {
            const authHeader = req.header('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        // If no token is found, deny access
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('+role +pin');

        // If user is not found in the database
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }
        console.error('Auth middleware error:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Middleware for role-based access control (RBAC)
 * Checks if the user's role is in the list of allowed roles
 */
const requireRoles = (roles = []) => {
    return (req, res, next) => {
        // Ensure the user is authenticated first
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please log in.'
            });
        }

        // Check if user's role is among the allowed roles
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have the required permissions.'
            });
        }

        next();
    };
};

/**
 * Middleware to check if the user has completed their profile
 */
const requireCompleteProfile = (req, res, next) => {
    // Assuming `isProfileComplete()` is a method on the User model
    if (req.user && !req.user.isProfileComplete()) {
        return res.status(403).json({
            success: false,
            message: 'Please complete your profile first.'
        });
    }

    next();
};

module.exports = {
    authMiddleware,
    requireRoles,
    requireCompleteProfile
};
