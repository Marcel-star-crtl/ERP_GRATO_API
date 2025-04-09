const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/smsService');

// exports.register = async (req, res) => {
//     try {
//         const { email, phone, password, fullName, role } = req.body;

//         if (!email && !phone) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Either email or phone is required'
//             });
//         }

//         if (!password) {
//             return res.status(400).json({ msg: 'Password is required' });
//         }

//         // Validate role
//         if (role && !['user', 'doer'].includes(role)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid role specified'
//             });
//         }

//         // Check for existing user
//         let query = email ? { email } : { phone };
//         const existingUser = await User.findOne(query);

//         if (existingUser) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'User already exists'
//             });
//         }

//         // Create verification tokens
//         const emailVerificationToken = email ? 
//             Math.floor(100000 + Math.random() * 900000).toString() : undefined;
//         const phoneVerificationToken = phone ? 
//             Math.floor(100000 + Math.random() * 900000).toString() : undefined;

//         // Create new user
//         const user = new User({
//             email,
//             phone,
//             password,
//             fullName,
//             role: role || 'user',
//             emailVerificationToken,
//             phoneVerificationToken
//         });

//         await user.save();

//         // Generate JWT
//         const token = jwt.sign(
//             { userId: user._id },
//             process.env.JWT_SECRET,
//             { expiresIn: '24h' }
//         );

//         // Send verification email if email is provided
//         if (email && emailVerificationToken) {
//             const emailOptions = {
//                 to: email,
//                 subject: 'Verify your Pikngo account',
//                 text: `Your verification code is: ${emailVerificationToken}`,
//                 html: `
//                     <div style="text-align: center; font-family: Arial, sans-serif;">
//                         <h2>Welcome to Pikngo!</h2>
//                         <p>Please verify your email address using the following code:</p>
//                         <h1 style="color: #4CAF50;">${emailVerificationToken}</h1>
//                         <p>This code will expire in 24 hours.</p>
//                         <p>If you didn't create an account with Pikngo, please ignore this email.</p>
//                     </div>
//                 `
//             };
            
//             try {
//                 await sendEmail(emailOptions);
//             } catch (emailError) {
//                 console.error('Failed to send verification email:', emailError);
//             }
//         }

//         // Send verification SMS if phone is provided
//         if (phone && phoneVerificationToken) {
//             try {
//                 // await sendSMS(phone, `Welcome to Pikngo! Your verification code is: ${phoneVerificationToken}. This code will expire in 24 hours.`);
//             } catch (smsError) {
//                 console.error('Failed to send verification SMS:', smsError);
//             }
//         }

//         res.status(201).json({
//             success: true,
//             message: 'Registration successful',
//             data: {
//                 token,
//                 user: {
//                     id: user._id,
//                     email: user.email,
//                     phone: user.phone,
//                     fullName: user.fullName,
//                     role: user.role,
//                     profileCompletionStatus: user.profileCompletionStatus,
//                     profileCompletionPercentage: user.profileCompletionPercentage
//                 }
//             }
//         });

//     } catch (error) {
//         console.error('Registration error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Registration failed',
//             error: error.message
//         });
//     }
// };

exports.register = async (req, res) => {
    try {
        const { email, phone, password, fullName, role } = req.body;

        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                message: 'Either email or phone is required'
            });
        }

        if (!password) {
            return res.status(400).json({ msg: 'Password is required' });
        }

        // Validate role
        if (role && !['user', 'doer'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role specified'
            });
        }

        // Check for existing user
        let query = email ? { email } : { phone };
        const existingUser = await User.findOne(query);

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Create verification tokens
        const emailVerificationToken = email ? 
            Math.floor(100000 + Math.random() * 900000).toString() : undefined;
        const phoneVerificationToken = phone ? 
            Math.floor(100000 + Math.random() * 900000).toString() : undefined;

        // Create new user with properly structured doerProfile
        const user = new User({
            email,
            phone,
            password,
            fullName,
            role: role || 'user',
            emailVerificationToken,
            phoneVerificationToken,
            status: 'unverified',
            balance: 0,
            profilePhoto: { verified: false },
            identificationDocument: { verified: false },
            preferredPaymentMethods: [],
            doerProfile: {
                availability: {
                    status: 'available',
                    schedule: []
                },
                serviceRadius: {
                    unit: 'km'
                },
                ratings: {
                    average: 0,
                    count: 0
                },
                currentLocation: {
                    type: 'Point',
                    coordinates: [0, 0] // Default coordinates [longitude, latitude]
                },
                locationSharingEnabled: false,
                completedTasks: 0,
                preferredRadius: 10,
                skills: [],
                services: []
            },
            profileCompletionStatus: 'pending',
            profileCompletionPercentage: 0,
            verificationStatus: 'unverified',
            fcmTokens: [],
            spokenLanguages: [],
            paymentDetails: []
        });

        await user.save();

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Send verification email if email is provided
        if (email && emailVerificationToken) {
            const emailOptions = {
                to: email,
                subject: 'Verify your Pikngo account',
                text: `Your verification code is: ${emailVerificationToken}`,
                html: `
                    <div style="text-align: center; font-family: Arial, sans-serif;">
                        <h2>Welcome to Pikngo!</h2>
                        <p>Please verify your email address using the following code:</p>
                        <h1 style="color: #4CAF50;">${emailVerificationToken}</h1>
                        <p>This code will expire in 24 hours.</p>
                        <p>If you didn't create an account with Pikngo, please ignore this email.</p>
                    </div>
                `
            };
            
            try {
                await sendEmail(emailOptions);
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
            }
        }

        // Send verification SMS if phone is provided
        if (phone && phoneVerificationToken) {
            try {
                // await sendSMS(phone, `Welcome to Pikngo! Your verification code is: ${phoneVerificationToken}. This code will expire in 24 hours.`);
            } catch (smsError) {
                console.error('Failed to send verification SMS:', smsError);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    phone: user.phone,
                    fullName: user.fullName,
                    role: user.role,
                    profileCompletionStatus: user.profileCompletionStatus,
                    profileCompletionPercentage: user.profileCompletionPercentage
                }
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                message: 'Either email or phone is required'
            });
        }

        // Find user
        let query = email ? { email } : { phone };
        const user = await User.findOne(query);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check verification status
        if (email && !user.emailVerified) {
        // if (email) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email first'
            });
        }

        if (phone && phone.trim() !== '' && !user.phoneVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your phone first'
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            success: true,
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    phone: user.phone,
                    fullName: user.fullName,
                    role: user.role,
                    profileCompletionStatus: user.profileCompletionStatus,
                    profileCompletionPercentage: user.profileCompletionPercentage
                }
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

exports.verifyEmail = async (req, res) => {
    try {
        const { email, token } = req.body;

        const user = await User.findOne({ email, emailVerificationToken: token });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });
        }

        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Email verified successfully'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Email verification failed',
            error: error.message
        });
    }
};

exports.verifyPhone = async (req, res) => {
    try {
        const { phone, token } = req.body;

        const user = await User.findOne({ phone, phoneVerificationToken: token });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });
        }

        user.phoneVerified = true;
        user.phoneVerificationToken = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Phone verified successfully'
        });

    } catch (error) {
        console.error('Phone verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Phone verification failed',
            error: error.message
        });
    }
};