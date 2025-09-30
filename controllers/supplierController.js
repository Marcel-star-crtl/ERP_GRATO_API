const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

// Register new supplier
exports.registerSupplier = async (req, res) => {
  try {
    console.log('=== SUPPLIER REGISTRATION ===');
    const {
      email,
      password,
      fullName,
      companyName,
      contactName,
      phoneNumber,
      address,
      businessRegistrationNumber,
      taxIdNumber,
      supplierType,
      bankDetails,
      businessInfo,
      contractInfo
    } = req.body;

    // Validate required fields
    if (!email || !password || !fullName || !companyName || !contactName || !phoneNumber || !supplierType) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if supplier already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create supplier user
    const supplierData = {
      email,
      password,
      fullName,
      role: 'supplier',
      isActive: false, // Inactive until approved
      supplierDetails: {
        companyName,
        contactName,
        phoneNumber,
        address,
        businessRegistrationNumber,
        taxIdNumber,
        supplierType,
        bankDetails,
        businessInfo,
        contractInfo
      },
      supplierStatus: {
        accountStatus: 'pending',
        isVerified: false,
        emailVerified: false,
        verificationToken
      }
    };

    const supplier = await User.create(supplierData);
    console.log('Supplier created:', supplier.email);

    // Send verification email
    const verificationUrl = `${process.env.CLIENT_URL}/suppliers/verify-email/${verificationToken}`;
    
    await sendEmail({
      to: email,
      subject: 'Verify Your Supplier Account - Grato Engineering',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #28a745;">Welcome to Grato Engineering Supplier Portal</h2>
            <p>Dear ${contactName},</p>
            
            <p>Thank you for registering as a supplier with Grato Engineering. Your account has been created and is pending approval.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Registration Details:</h3>
              <ul>
                <li><strong>Company:</strong> ${companyName}</li>
                <li><strong>Supplier Type:</strong> ${supplierType}</li>
                <li><strong>Contact:</strong> ${contactName}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Status:</strong> Pending Verification & Approval</li>
              </ul>
            </div>
            
            <p><strong>Please verify your email address by clicking the link below:</strong></p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Click the verification link above to verify your email</li>
                <li>Our team will review your application</li>
                <li>You'll receive an email notification once approved</li>
                <li>Start submitting invoices through our portal</li>
              </ol>
            </div>
            
            <p>If you have any questions, please contact our supply chain team.</p>
            <p>Best regards,<br>Grato Engineering Team</p>
          </div>
        </div>
      `
    });

    // Notify admin/finance of new supplier registration
    const adminUsers = await User.find({ 
      role: { $in: ['admin', 'finance'] } 
    }).select('email fullName');

    if (adminUsers.length > 0) {
      await sendEmail({
        to: adminUsers.map(u => u.email),
        subject: `New Supplier Registration - ${companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px;">
              <h3>New Supplier Registration</h3>
              <p>A new supplier has registered and requires approval.</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 5px;">
                <ul>
                  <li><strong>Company:</strong> ${companyName}</li>
                  <li><strong>Contact:</strong> ${contactName}</li>
                  <li><strong>Email:</strong> ${email}</li>
                  <li><strong>Type:</strong> ${supplierType}</li>
                  <li><strong>Phone:</strong> ${phoneNumber}</li>
                  <li><strong>Business Reg:</strong> ${businessRegistrationNumber || 'Not provided'}</li>
                </ul>
              </div>
              
              <p>Please review and approve/reject this supplier registration.</p>
            </div>
          </div>
        `
      });
    }

    res.status(201).json({
      success: true,
      message: 'Supplier registration successful. Please check your email to verify your account.',
      data: {
        id: supplier._id,
        email: supplier.email,
        companyName: supplier.supplierDetails.companyName,
        status: 'pending_verification'
      }
    });

  } catch (error) {
    console.error('Supplier registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// Verify supplier email
exports.verifySupplierEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    const supplier = await User.findOne({
      'supplierStatus.verificationToken': token,
      role: 'supplier'
    });

    if (!supplier) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    supplier.supplierStatus.emailVerified = true;
    supplier.supplierStatus.verificationToken = undefined;
    await supplier.save();

    res.json({
      success: true,
      message: 'Email verified successfully. Your account is now pending admin approval.'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
};

// Supplier login
exports.loginSupplier = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find supplier
    const supplier = await User.findOne({ 
      email, 
      role: 'supplier' 
    });

    if (!supplier) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await supplier.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check email verification
    if (!supplier.supplierStatus.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in.'
      });
    }

    // Check account status
    if (supplier.supplierStatus.accountStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Your supplier account is ${supplier.supplierStatus.accountStatus}. Please contact administrator.`
      });
    }

    if (!supplier.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact administrator.'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { 
        userId: supplier._id,
        role: supplier.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    supplier.lastLogin = new Date();
    await supplier.save();

    res.json({
      success: true,
      token,
      supplier: {
        id: supplier._id,
        email: supplier.email,
        fullName: supplier.fullName,
        companyName: supplier.supplierDetails.companyName,
        supplierType: supplier.supplierDetails.supplierType,
        role: supplier.role,
        accountStatus: supplier.supplierStatus.accountStatus
      }
    });

  } catch (error) {
    console.error('Supplier login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Get supplier profile
exports.getSupplierProfile = async (req, res) => {
  try {
    const supplier = await User.findById(req.supplier.userId)
      .select('-password')
      .populate('supplierStatus.approvedBy', 'fullName email');

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier
    });

  } catch (error) {
    console.error('Error fetching supplier profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};

// Update supplier profile
exports.updateSupplierProfile = async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Don't allow updating sensitive fields
    delete updateData.role;
    delete updateData.supplierStatus;
    delete updateData.password;

    const supplier = await User.findByIdAndUpdate(
      req.supplier.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: supplier
    });

  } catch (error) {
    console.error('Error updating supplier profile:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// Get all suppliers (admin/finance only)
exports.getAllSuppliers = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    
    const filter = { role: 'supplier' };
    if (status) filter['supplierStatus.accountStatus'] = status;
    if (type) filter['supplierDetails.supplierType'] = type;
    
    const skip = (page - 1) * limit;
    
    const suppliers = await User.find(filter)
      .select('-password')
      .populate('supplierStatus.approvedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(filter);
    
    res.json({
      success: true,
      data: suppliers,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suppliers'
    });
  }
};

// Update supplier status (approve/reject)
exports.updateSupplierStatus = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { status, comments } = req.body;

    if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved, rejected, suspended, or pending.'
      });
    }

    const supplier = await User.findOne({
      _id: supplierId,
      role: 'supplier'
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    supplier.supplierStatus.accountStatus = status;
    supplier.isActive = status === 'approved';
    
    if (status === 'approved') {
      supplier.supplierStatus.approvalDate = new Date();
      supplier.supplierStatus.approvedBy = req.user.userId;
    }

    await supplier.save();

    // Send notification email
    const statusMessages = {
      approved: 'approved and activated',
      rejected: 'rejected',
      suspended: 'suspended'
    };

    await sendEmail({
      to: supplier.email,
      subject: `Supplier Account ${status.toUpperCase()} - Grato Engineering`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${status === 'approved' ? '#d4edda' : '#f8d7da'}; padding: 20px; border-radius: 8px;">
            <h2>Supplier Account Status Update</h2>
            <p>Dear ${supplier.supplierDetails.contactName},</p>
            
            <p>Your supplier account for <strong>${supplier.supplierDetails.companyName}</strong> has been <strong>${statusMessages[status]}</strong>.</p>
            
            ${status === 'approved' ? `
            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Congratulations!</strong> You can now:</p>
              <ul>
                <li>Access the supplier portal</li>
                <li>Submit invoices for approval</li>
                <li>Track invoice status</li>
                <li>Update your company profile</li>
              </ul>
              <p>Login at: <a href="${process.env.CLIENT_URL}/supplier/login">Supplier Portal</a></p>
            </div>
            ` : `
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Reason:</strong> ${comments || 'No specific reason provided'}</p>
              ${status === 'rejected' ? '<p>If you believe this is an error, please contact our supply chain team.</p>' : ''}
            </div>
            `}
            
            <p>Best regards,<br>Grato Engineering Team</p>
          </div>
        </div>
      `
    });

    res.json({
      success: true,
      message: `Supplier ${status} successfully`,
      data: supplier
    });

  } catch (error) {
    console.error('Error updating supplier status:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update supplier status',
      error: error.message
    });
  }
};



