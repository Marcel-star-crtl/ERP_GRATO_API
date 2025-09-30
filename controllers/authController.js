const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.login = async (req, res) => {
    try {
        console.log('=== LOGIN ATTEMPT ===');
        console.log('Request body:', req.body);
        
        const { email, password } = req.body;

        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        console.log(`Attempting to find user with email: ${email}`);
        
        // Find user
        const user = await User.findOne({ email });
        console.log('User found:', user ? 'YES' : 'NO');
        
        if (!user) {
            console.log('User not found in database');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log('User details:', {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            isActive: user.isActive,
            hashedPassword: user.password.substring(0, 20) + '...'  
        });

        // Check if account is active
        if (!user.isActive) {
            console.log('User account is not active');
            return res.status(403).json({
                success: false,
                message: 'Your account is not active. Please contact administrator.'
            });
        }

        console.log(`Comparing password: "${password}" with stored hash`);
        
        // Verify password
        const isValidPassword = await user.comparePassword(password);
        console.log('Password comparison result:', isValidPassword);
        
        if (!isValidPassword) {
            console.log('Password comparison failed');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log('Password verified successfully, generating JWT');

        // Generate JWT
        const token = jwt.sign(
            { 
                userId: user._id,
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('JWT generated successfully');

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        console.log('Login successful for user:', user.email);

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                department: user.department
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};


exports.logout = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: error.message
        });
    }
};

// Get active users for project manager selection
exports.getActiveUsers = async (req, res) => {
    try {
        console.log('=== GET ACTIVE USERS FOR PROJECT MANAGERS ===');
        
        const users = await User.find({ 
            isActive: true,
            role: { $in: ['admin', 'manager', 'supervisor', 'supply_chain', 'finance', 'employee'] }
        })
        .select('fullName email role department')
        .sort({ fullName: 1 });

        console.log(`Found ${users.length} active users`);

        // Transform to match frontend expectations
        const transformedUsers = users.map(user => ({
            _id: user._id,
            id: user._id,
            fullName: user.fullName,
            name: user.fullName,
            email: user.email,
            role: user.role,
            department: user.department,
            isActive: true
        }));

        res.json({
            success: true,
            data: transformedUsers
        });

    } catch (error) {
        console.error('Get active users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active users',
            error: error.message
        });
    }
};

