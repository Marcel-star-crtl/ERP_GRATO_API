const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const User = require('../models/User');

// ==========================================
// AUTHENTICATION
// ==========================================

router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .populate('supervisor', 'fullName email position')
            .populate('departmentHead', 'fullName email position')
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                department: user.department,
                position: user.position,
                hierarchyLevel: user.hierarchyLevel,
                approvalCapacities: user.approvalCapacities,
                supervisor: user.supervisor,
                departmentHead: user.departmentHead,
                permissions: user.permissions
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: error.message
        });
    }
});

// ==========================================
// USER CREATION & HIERARCHY
// ==========================================

// Create user with hierarchy (Admin only)
router.post('/users/create-with-hierarchy', 
    authMiddleware, 
    requireRoles('admin'), 
    authController.createUserWithHierarchy
);

// Get available positions
router.get('/positions/available', 
    authMiddleware, 
    requireRoles('admin'), 
    authController.getAvailablePositions
);

// Get potential supervisors for position
router.get('/positions/supervisors', 
    authMiddleware, 
    requireRoles('admin'), 
    authController.getPotentialSupervisorsForPosition
);

// ==========================================
// HIERARCHY MANAGEMENT
// ==========================================

// Update user supervisor (Admin only)
router.put('/users/:userId/supervisor', 
    authMiddleware, 
    requireRoles('admin'), 
    authController.updateUserSupervisor
);

// Get user's direct reports
router.get('/users/direct-reports', 
    authMiddleware, 
    authController.getDirectReports
);

// Get my approval chain
router.get('/workflow/my-chain', 
    authMiddleware, 
    authController.getMyApprovalChain
);

// Preview workflow
router.get('/workflow/preview', 
    authMiddleware, 
    authController.previewWorkflow
);

// Validate user hierarchy (Admin only)
router.get('/users/:userId/validate-hierarchy', 
    authMiddleware, 
    requireRoles('admin'), 
    authController.validateUserHierarchy
);

// ==========================================
// USER QUERIES
// ==========================================

// Get all active users
router.get('/active-users', 
    authMiddleware, 
    authController.getActiveUsers
);

// Get all supervisors (for dropdowns)
router.get('/supervisors', authMiddleware, async (req, res) => {
    try {
        const supervisors = await User.find({
            isActive: true,
            $or: [
                { approvalCapacities: { $exists: true, $ne: [] } },
                { directReports: { $exists: true, $ne: [] } }
            ]
        })
        .select('_id fullName email department position directReports')
        .lean();

        res.json({
            success: true,
            data: supervisors
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch supervisors',
            error: error.message
        });
    }
});

// Get user by email
router.get('/user-by-email', authMiddleware, async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            isActive: true
        }).select('_id fullName email department position role hierarchyLevel');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found or not active'
            });
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Find user by email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to find user',
            error: error.message
        });
    }
});

// Get departments list
router.get('/departments', authMiddleware, async (req, res) => {
    try {
        const departments = await User.distinct('department');
        res.json({
            success: true,
            data: departments.filter(dept => dept)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch departments',
            error: error.message
        });
    }
});

// ==========================================
// ADMIN USER MANAGEMENT
// ==========================================

// Get all users (Admin only)
router.get('/users', authMiddleware, requireRoles('admin'), async (req, res) => {
    try {
        const { role, department, page = 1, limit = 50, search } = req.query;

        let query = {};

        if (role) query.role = role;
        if (department) query.department = department;

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { position: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .populate('supervisor', 'fullName email')
            .populate('departmentHead', 'fullName email')
            .select('-password')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: {
                users,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                totalUsers: total
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
});

// Get specific user (Admin only)
router.get('/users/:userId', authMiddleware, requireRoles('admin'), async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .populate('supervisor', 'fullName email position')
            .populate('departmentHead', 'fullName email position')
            .populate('directReports', 'fullName email position')
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: { user }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: error.message
        });
    }
});

// Update user (Admin only)
router.put('/users/:userId', authMiddleware, requireRoles('admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;

        // Remove sensitive fields
        delete updateData.password;
        delete updateData._id;
        delete updateData.__v;
        delete updateData.hierarchyPath; // Recalculated automatically

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        )
        .select('-password')
        .populate('supervisor', 'fullName email')
        .populate('departmentHead', 'fullName email');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message
        });
    }
});

// Toggle user status (Admin only)
router.put('/users/:userId/status', authMiddleware, requireRoles('admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isActive },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update user status',
            error: error.message
        });
    }
});

// Delete user (Admin only)
router.delete('/users/:userId', authMiddleware, requireRoles('admin'), async (req, res) => {
    try {
        const { userId } = req.params;

        // Prevent deletion of last admin
        const user = await User.findById(userId);
        if (user && user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete the last admin user'
                });
            }
        }

        // Remove from supervisor's directReports
        if (user.supervisor) {
            await User.findByIdAndUpdate(user.supervisor, {
                $pull: { directReports: userId }
            });
        }

        const deletedUser = await User.findByIdAndDelete(userId);

        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User deleted successfully',
            data: { deletedUserId: userId }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error.message
        });
    }
});

// ==========================================
// ORGANIZATIONAL CHARTS & REPORTING
// ==========================================

// Get organization chart
router.get('/org-chart', authMiddleware, async (req, res) => {
    try {
        const { departmentFilter } = req.query;

        let query = { isActive: true };
        if (departmentFilter) query.department = departmentFilter;

        const users = await User.find(query)
            .populate('supervisor', 'fullName email position')
            .populate('directReports', 'fullName email position department')
            .select('fullName email position department hierarchyLevel approvalCapacities supervisor directReports')
            .sort({ hierarchyLevel: -1 });

        // Build tree structure
        const buildTree = (users, parentId = null) => {
            return users
                .filter(u => {
                    const supervisorId = u.supervisor?._id?.toString();
                    return parentId ? supervisorId === parentId : !supervisorId;
                })
                .map(user => ({
                    id: user._id,
                    name: user.fullName,
                    email: user.email,
                    position: user.position,
                    department: user.department,
                    hierarchyLevel: user.hierarchyLevel,
                    approvalCapacities: user.approvalCapacities,
                    children: buildTree(users, user._id.toString())
                }));
        };

        const orgChart = buildTree(users);

        res.json({
            success: true,
            data: orgChart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch org chart',
            error: error.message
        });
    }
});

module.exports = router;









// const express = require('express');
// const router = express.Router();
// const authController = require('../controllers/authController');
// const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
// const User = require('../models/User');

// // Auth routes
// router.post('/login', authController.login);
// router.post('/logout', authMiddleware, authController.logout);

// // Protected route example
// router.get('/me', authMiddleware, (req, res) => {
//     res.json({
//         success: true,
//         user: {
//             id: req.user._id,
//             email: req.user.email,
//             fullName: req.user.fullName,
//             role: req.user.role,
//             department: req.user.department
//         }
//     });
// });

// // Get all supervisors
// router.get('/supervisors', async (req, res) => {
//     try {
//       const supervisors = await User.find({ role: 'supervisor' })
//         .select('_id fullName email department isActive')
//         .lean();
      
//       res.json({
//         success: true,
//         data: supervisors
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch supervisors',
//         error: error.message
//       });
//     }
// });

// // Get active users for project manager selection
// router.get('/active-users', authMiddleware, authController.getActiveUsers);

// // Get all users with filtering and pagination
// router.get('/users', authMiddleware, requireRoles('admin'), async (req, res) => {
//   try {
//       const { role, page = 1, limit = 10, verificationStatus } = req.query;
      
//       // Build query object
//       let query = {};
//       if (role) {
//           query.role = role;
//       }
      
//       // Add verification status filtering
//       if (verificationStatus === 'verified') {
//           query.$or = [
//               { emailVerified: true },
//               { phoneVerified: true }
//           ];
//       } else if (verificationStatus === 'unverified') {
//           query.$and = [
//               { emailVerified: false },
//               { phoneVerified: false }
//           ];
//       }

//       const users = await User
//           .find(query)
//           .select('-password -emailVerificationToken -phoneVerificationToken')
//           .limit(limit * 1)
//           .skip((page - 1) * limit)
//           .sort({ createdAt: -1 });

//       const totalUsers = await User.countDocuments(query);

//       res.status(200).json({
//           success: true,
//           data: {
//               users,
//               totalPages: Math.ceil(totalUsers / limit),
//               currentPage: parseInt(page),
//               totalUsers
//           }
//       });
//   } catch (error) {
//       console.error('Error fetching users:', error);
//       res.status(500).json({
//           success: false,
//           message: 'Failed to fetch users',
//           error: error.message
//       });
//   }
// });

// // Get specific user
// router.get('/users/:userId', authMiddleware, async (req, res) => {
//   try {
//       const { userId } = req.params;
      
//       const user = await User
//           .findById(userId)
//           .select('-password -emailVerificationToken -phoneVerificationToken');

//       if (!user) {
//           return res.status(404).json({
//               success: false,
//               message: 'User not found'
//           });
//       }

//       // Check permissions
//       if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
//           return res.status(403).json({
//               success: false,
//               message: 'Access denied'
//           });
//       }

//       res.status(200).json({
//           success: true,
//           data: { user }
//       });
//   } catch (error) {
//       console.error('Error fetching user:', error);
//       res.status(500).json({
//           success: false,
//           message: 'Failed to fetch user',
//           error: error.message
//       });
//   }
// });

// // Get user by email (for fallback user resolution)
// router.get('/user-by-email', authMiddleware, async (req, res) => {
//   try {
//     const { email } = req.query;
    
//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         message: 'Email is required'
//       });
//     }

//     const user = await User.findOne({ 
//       email: email.toLowerCase(),
//       isActive: true 
//     }).select('_id fullName email department position role');

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found or not active'
//       });
//     }

//     res.json({
//       success: true,
//       data: user
//     });

//   } catch (error) {
//     console.error('Find user by email error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to find user',
//       error: error.message
//     });
//   }
// });

// // Search users
// router.get('/users/search', authMiddleware, requireRoles('admin'), async (req, res) => {
//   try {
//       const { query, page = 1, limit = 10 } = req.query;

//       const searchQuery = {
//           $or: [
//               { fullName: { $regex: query, $options: 'i' } },
//               { email: { $regex: query, $options: 'i' } },
//               { phone: { $regex: query, $options: 'i' } }
//           ]
//       };

//       const users = await User
//           .find(searchQuery)
//           .select('-password -emailVerificationToken -phoneVerificationToken')
//           .limit(limit * 1)
//           .skip((page - 1) * limit)
//           .sort({ createdAt: -1 });

//       const count = await User.countDocuments(searchQuery);

//       res.status(200).json({
//           success: true,
//           data: {
//               users,
//               totalPages: Math.ceil(count / limit),
//               currentPage: parseInt(page),
//               totalUsers: count
//           }
//       });
//   } catch (error) {
//       console.error('Error searching users:', error);
//       res.status(500).json({
//           success: false,
//           message: 'Failed to search users',
//           error: error.message
//       });
//   }
// });

// // Get departments list
// router.get('/users/departments', authMiddleware, async (req, res) => {
//   try {
//     const departments = await User.distinct('department');
//     res.json({
//       success: true,
//       data: departments.filter(dept => dept) 
//     });
//   } catch (error) {
//     console.error('Error fetching departments:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch departments',
//       error: error.message
//     });
//   }
// });

// // Admin user management endpoints
// router.get('/users/admin/all', authMiddleware, requireRoles('admin'), async (req, res) => {
//   try {
//     const users = await User
//       .find({})
//       .select('-password -emailVerificationToken -phoneVerificationToken')
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       data: users
//     });
//   } catch (error) {
//     console.error('Error fetching all users:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch users',
//       error: error.message
//     });
//   }
// });

// router.post('/users/admin/create', authMiddleware, requireRoles('admin'), async (req, res) => {
//   try {
//     const { email, password, fullName, department, position, role, phone, isActive } = req.body;

//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({
//         success: false,
//         message: 'User with this email already exists'
//       });
//     }

//     // Create new user
//     const newUser = new User({
//       email,
//       password, 
//       fullName,
//       department,
//       position,
//       role: role || 'employee',
//       phone,
//       isActive: isActive !== false,
//       emailVerified: true 
//     });

//     await newUser.save();

//     // Remove password from response
//     const userResponse = newUser.toObject();
//     delete userResponse.password;

//     res.status(201).json({
//       success: true,
//       message: 'User created successfully',
//       data: userResponse
//     });
//   } catch (error) {
//     console.error('Error creating user:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to create user',
//       error: error.message
//     });
//   }
// });

// router.put('/users/admin/:userId', authMiddleware, requireRoles('admin'), async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const updateData = req.body;

//     // Remove sensitive fields from update
//     delete updateData.password;
//     delete updateData._id;
//     delete updateData.__v;

//     const updatedUser = await User
//       .findByIdAndUpdate(userId, updateData, { new: true, runValidators: true })
//       .select('-password -emailVerificationToken -phoneVerificationToken');

//     if (!updatedUser) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     res.json({
//       success: true,
//       message: 'User updated successfully',
//       data: updatedUser
//     });
//   } catch (error) {
//     console.error('Error updating user:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update user',
//       error: error.message
//     });
//   }
// });

// router.put('/users/admin/:userId/status', authMiddleware, requireRoles('admin'), async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { isActive } = req.body;

//     const updatedUser = await User
//       .findByIdAndUpdate(userId, { isActive }, { new: true })
//       .select('-password -emailVerificationToken -phoneVerificationToken');

//     if (!updatedUser) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     res.json({
//       success: true,
//       message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
//       data: updatedUser
//     });
//   } catch (error) {
//     console.error('Error updating user status:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update user status',
//       error: error.message
//     });
//   }
// });

// router.delete('/users/admin/:userId', authMiddleware, requireRoles('admin'), async (req, res) => {
//   try {
//     const { userId } = req.params;

//     // Prevent deletion of the last admin
//     const user = await User.findById(userId);
//     if (user && user.role === 'admin') {
//       const adminCount = await User.countDocuments({ role: 'admin' });
//       if (adminCount <= 1) {
//         return res.status(400).json({
//           success: false,
//           message: 'Cannot delete the last admin user'
//         });
//       }
//     }

//     const deletedUser = await User.findByIdAndDelete(userId);

//     if (!deletedUser) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     res.json({
//       success: true,
//       message: 'User deleted successfully',
//       data: { deletedUserId: userId }
//     });
//   } catch (error) {
//     console.error('Error deleting user:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to delete user',
//       error: error.message
//     });
//   }
// });

// module.exports = router;