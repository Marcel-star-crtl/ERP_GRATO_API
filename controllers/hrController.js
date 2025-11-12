const User = require('../models/User');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// @desc    Get HR statistics for dashboard
// @route   GET /api/hr/employees/statistics
// @access  Private (HR, Admin)
exports.getStatistics = async (req, res) => {
  try {
    const totalEmployees = await User.countDocuments({ 
      role: { $ne: 'supplier' },
      isActive: true 
    });

    const activeEmployees = await User.countDocuments({
      role: { $ne: 'supplier' },
      isActive: true,
      'employmentDetails.employmentStatus': 'Active'
    });

    const inactiveEmployees = await User.countDocuments({
      role: { $ne: 'supplier' },
      isActive: false
    });

    const onProbation = await User.countDocuments({
      role: { $ne: 'supplier' },
      'employmentDetails.employmentStatus': 'Probation'
    });

    const onLeave = await User.countDocuments({
      role: { $ne: 'supplier' },
      'employmentDetails.employmentStatus': 'On Leave'
    });

    const noticePeriod = await User.countDocuments({
      role: { $ne: 'supplier' },
      'employmentDetails.employmentStatus': 'Notice Period'
    });

    const suspended = await User.countDocuments({
      role: { $ne: 'supplier' },
      'employmentDetails.employmentStatus': 'Suspended'
    });

    // Count employees with incomplete documents
    const allEmployees = await User.find({ 
      role: { $ne: 'supplier' },
      isActive: true 
    }).select('employmentDetails.documents');

    let pendingDocuments = 0;
    allEmployees.forEach(emp => {
      const requiredDocs = [
        'nationalId', 'birthCertificate', 'bankAttestation', 
        'locationPlan', 'medicalCertificate', 'criminalRecord', 
        'employmentContract'
      ];
      
      const docs = emp.employmentDetails?.documents || {};
      const hasAllDocs = requiredDocs.every(doc => 
        docs[doc] && (docs[doc].filename || docs[doc].filePath)
      );
      
      if (!hasAllDocs) pendingDocuments++;
    });

    // Department distribution
    const departmentAggregation = await User.aggregate([
      { 
        $match: { 
          role: { $ne: 'supplier' },
          isActive: true 
        } 
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      }
    ]);

    const departmentDistribution = {};
    departmentAggregation.forEach(dept => {
      if (dept._id) {
        departmentDistribution[dept._id] = dept.count;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        onProbation,
        onLeave,
        noticePeriod,
        suspended,
        pendingDocuments,
        departmentDistribution
      }
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// @desc    Get all employees with filters
// @route   GET /api/hr/employees
// @access  Private (HR, Admin)
exports.getEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      department = '',
      status = '',
      contractType = '',
      contractExpiring = ''
    } = req.query;

    const query = { role: { $ne: 'supplier' } };

    // Search by name or email
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'employmentDetails.employeeId': { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by department
    if (department) {
      query.department = department;
    }

    // Filter by employment status
    if (status) {
      query['employmentDetails.employmentStatus'] = status;
    }

    // Filter by contract type
    if (contractType) {
      query['employmentDetails.contractType'] = contractType;
    }

    // Filter by contracts expiring soon
    if (contractExpiring) {
      const days = parseInt(contractExpiring);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      query['employmentDetails.contractEndDate'] = {
        $gte: new Date(),
        $lte: futureDate
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const employees = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: employees,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
};

// @desc    Get single employee
// @route   GET /api/hr/employees/:id
// @access  Private (HR, Admin)
exports.getEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id)
      .select('-password')
      .populate('supervisor', 'fullName email')
      .populate('departmentHead', 'fullName email');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      data: employee
    });

  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee',
      error: error.message
    });
  }
};

// @desc    Create new employee
// @route   POST /api/hr/employees
// @access  Private (HR, Admin)
exports.createEmployee = async (req, res) => {
  try {
    const {
      fullName,
      email,
      department,
      position,
      role = 'employee',
      departmentRole = 'staff',
      employmentDetails
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Calculate probation end date if not provided
    if (employmentDetails && employmentDetails.startDate && !employmentDetails.probationEndDate) {
      const startDate = new Date(employmentDetails.startDate);
      const probationEnd = new Date(startDate);
      probationEnd.setMonth(probationEnd.getMonth() + 3); // 3 months probation
      employmentDetails.probationEndDate = probationEnd;
    }

    // Create employee
    const employee = await User.create({
      fullName,
      email,
      password: tempPassword,
      department,
      position,
      role,
      departmentRole,
      employmentDetails: {
        ...employmentDetails,
        employmentStatus: employmentDetails?.employmentStatus || 'Probation'
      },
      isActive: true
    });

    // Send welcome email with credentials
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to the Company - Account Created',
        html: `
          <h2>Welcome ${fullName}!</h2>
          <p>Your employee account has been created by HR.</p>
          <h3>Login Credentials:</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p><strong>Login URL:</strong> ${process.env.FRONTEND_URL}/login</p>
          <p style="color: red;"><strong>Important:</strong> Please change your password immediately after first login.</p>
          <hr>
          <p>If you have any questions, please contact HR department.</p>
        `
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the creation if email fails
    }

    // Remove password from response
    employee.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Employee created successfully. Login credentials sent to email.',
      data: employee
    });

  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
      error: error.message
    });
  }
};

// @desc    Update employee
// @route   PUT /api/hr/employees/:id
// @access  Private (HR, Admin)
exports.updateEmployee = async (req, res) => {
  try {
    const {
      fullName,
      department,
      position,
      role,
      departmentRole,
      employmentDetails
    } = req.body;

    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Update fields
    if (fullName) employee.fullName = fullName;
    if (department) employee.department = department;
    if (position) employee.position = position;
    if (role) employee.role = role;
    if (departmentRole) employee.departmentRole = departmentRole;

    // Update employment details
    if (employmentDetails) {
      employee.employmentDetails = {
        ...employee.employmentDetails,
        ...employmentDetails
      };
    }

    await employee.save();

    // Remove password from response
    employee.password = undefined;

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });

  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: error.message
    });
  }
};

// @desc    Update employee status
// @route   PATCH /api/hr/employees/:id/status
// @access  Private (HR, Admin)
exports.updateEmployeeStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['Active', 'Inactive', 'On Leave', 'Suspended', 'Notice Period', 'Probation', 'Terminated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employment status'
      });
    }

    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    employee.employmentDetails.employmentStatus = status;
    
    // If terminated, set inactive
    if (status === 'Terminated') {
      employee.isActive = false;
      employee.employmentDetails.terminationDate = new Date();
    }

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Employee status updated successfully',
      data: employee
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee status',
      error: error.message
    });
  }
};

// @desc    Deactivate employee (soft delete)
// @route   DELETE /api/hr/employees/:id
// @access  Private (HR, Admin)
exports.deactivateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    employee.isActive = false;
    employee.employmentDetails.employmentStatus = 'Inactive';
    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Employee deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate employee',
      error: error.message
    });
  }
};

// @desc    Upload employee document
// @route   POST /api/hr/employees/:id/documents/:type
// @access  Private (HR, Admin)
exports.uploadDocument = async (req, res) => {
  try {
    const { id, type } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const employee = await User.findById(id);

    if (!employee) {
      // Delete uploaded file
      await unlinkAsync(file.path);
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Initialize documents object if not exists
    if (!employee.employmentDetails) {
      employee.employmentDetails = {};
    }
    if (!employee.employmentDetails.documents) {
      employee.employmentDetails.documents = {};
    }

    const documentData = {
      name: file.originalname,
      filename: file.filename,
      filePath: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.user._id
    };

    // Check if document type supports multiple files
    const multipleDocsTypes = ['references', 'academicDiplomas', 'workCertificates'];

    if (multipleDocsTypes.includes(type)) {
      // Initialize array if not exists
      if (!employee.employmentDetails.documents[type]) {
        employee.employmentDetails.documents[type] = [];
      }
      employee.employmentDetails.documents[type].push(documentData);
    } else {
      // Delete old file if exists
      const oldDoc = employee.employmentDetails.documents[type];
      if (oldDoc && oldDoc.filePath) {
        try {
          await unlinkAsync(oldDoc.filePath);
        } catch (err) {
          console.error('Error deleting old file:', err);
        }
      }
      employee.employmentDetails.documents[type] = documentData;
    }

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: documentData
    });

  } catch (error) {
    console.error('Upload document error:', error);
    // Delete uploaded file on error
    if (req.file) {
      try {
        await unlinkAsync(req.file.path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  }
};

// @desc    Download employee document
// @route   GET /api/hr/employees/:id/documents/:type
// @access  Private (HR, Admin)
exports.downloadDocument = async (req, res) => {
  try {
    const { id, type } = req.params;

    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const document = employee.employmentDetails?.documents?.[type];

    if (!document || !document.filePath) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    res.download(document.filePath, document.name);

  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download document',
      error: error.message
    });
  }
};

// @desc    Delete employee document
// @route   DELETE /api/hr/employees/:id/documents/:docId
// @access  Private (HR, Admin)
exports.deleteDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;

    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const docs = employee.employmentDetails?.documents;
    if (!docs) {
      return res.status(404).json({
        success: false,
        message: 'No documents found'
      });
    }

    let deleted = false;
    let filePath = null;

    // Check each document type
    for (const [key, value] of Object.entries(docs)) {
      if (Array.isArray(value)) {
        // Multiple documents
        const index = value.findIndex(doc => doc._id && doc._id.toString() === docId);
        if (index !== -1) {
          filePath = value[index].filePath;
          value.splice(index, 1);
          deleted = true;
          break;
        }
      } else if (value && value._id && value._id.toString() === docId) {
        // Single document
        filePath = value.filePath;
        docs[key] = null;
        deleted = true;
        break;
      }
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Delete physical file
    if (filePath) {
      try {
        await unlinkAsync(filePath);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: error.message
    });
  }
};

// @desc    Get contracts expiring soon
// @route   GET /api/hr/contracts/expiring
// @access  Private (HR, Admin)
exports.getExpiringContracts = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const employees = await User.find({
      role: { $ne: 'supplier' },
      'employmentDetails.contractEndDate': {
        $gte: new Date(),
        $lte: futureDate
      }
    })
      .select('-password')
      .sort('employmentDetails.contractEndDate')
      .lean();

    res.status(200).json({
      success: true,
      data: employees
    });

  } catch (error) {
    console.error('Get expiring contracts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expiring contracts',
      error: error.message
    });
  }
};

// @desc    Request contract renewal
// @route   POST /api/hr/contracts/:id/renew
// @access  Private (HR, Admin)
exports.requestContractRenewal = async (req, res) => {
  try {
    const { newEndDate, contractType, notes } = req.body;

    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Create renewal request (store in a separate collection or as pending status)
    // For now, we'll send email to admin for approval

    try {
      // Get admin users
      const admins = await User.find({ role: 'admin', isActive: true });
      
      for (const admin of admins) {
        await sendEmail({
          to: admin.email,
          subject: 'Contract Renewal Approval Required',
          html: `
            <h2>Contract Renewal Request</h2>
            <p>A contract renewal request requires your approval:</p>
            <hr>
            <p><strong>Employee:</strong> ${employee.fullName}</p>
            <p><strong>Department:</strong> ${employee.department}</p>
            <p><strong>Position:</strong> ${employee.position}</p>
            <p><strong>Current Contract Type:</strong> ${employee.employmentDetails?.contractType}</p>
            <p><strong>Current End Date:</strong> ${new Date(employee.employmentDetails?.contractEndDate).toLocaleDateString()}</p>
            <hr>
            <p><strong>Requested New Contract Type:</strong> ${contractType}</p>
            <p><strong>Requested New End Date:</strong> ${new Date(newEndDate).toLocaleDateString()}</p>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            <hr>
            <p>Please review and approve/reject this request in the HR system.</p>
            <p><a href="${process.env.FRONTEND_URL}/admin/hr/contracts">Review Contract Renewals</a></p>
          `
        });
      }
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Contract renewal request submitted for admin approval'
    });

  } catch (error) {
    console.error('Request renewal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit renewal request',
      error: error.message
    });
  }
};

// @desc    Approve contract renewal (Admin only)
// @route   PUT /api/hr/contracts/:id/approve
// @access  Private (Admin)
exports.approveContractRenewal = async (req, res) => {
  try {
    const { newEndDate, contractType, approved } = req.body;

    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (approved) {
      employee.employmentDetails.contractEndDate = new Date(newEndDate);
      employee.employmentDetails.contractType = contractType;
      await employee.save();

      // Notify employee and HR
      try {
        await sendEmail({
          to: employee.email,
          subject: 'Contract Renewal Approved',
          html: `
            <h2>Contract Renewal Approved</h2>
            <p>Dear ${employee.fullName},</p>
            <p>Your employment contract has been renewed:</p>
            <p><strong>New Contract Type:</strong> ${contractType}</p>
            <p><strong>New End Date:</strong> ${new Date(newEndDate).toLocaleDateString()}</p>
            <p>Thank you for your continued service.</p>
          `
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }

      res.status(200).json({
        success: true,
        message: 'Contract renewal approved',
        data: employee
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'Contract renewal rejected'
      });
    }

  } catch (error) {
    console.error('Approve renewal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process renewal approval',
      error: error.message
    });
  }
};

// @desc    Get employee leave balance
// @route   GET /api/hr/employees/:id/leave-balance
// @access  Private (HR, Admin)
exports.getEmployeeLeaveBalance = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Fetch leave data from leave management system
    const SickLeave = require('../models/SickLeave');
    
    const leaves = await SickLeave.find({ 
      employee: req.params.id,
      status: 'approved'
    }).sort('-startDate').limit(10);

    // Calculate balances
    const currentYear = new Date().getFullYear();
    const annualLeavesThisYear = leaves.filter(leave => 
      leave.leaveType === 'annual' && 
      new Date(leave.startDate).getFullYear() === currentYear
    );

    const sickLeavesThisYear = leaves.filter(leave => 
      leave.leaveType === 'sick' && 
      new Date(leave.startDate).getFullYear() === currentYear
    );

    const annualLeaveUsed = annualLeavesThisYear.reduce((sum, leave) => 
      sum + leave.numberOfDays, 0
    );
    const sickLeaveUsed = sickLeavesThisYear.reduce((sum, leave) => 
      sum + leave.numberOfDays, 0
    );

    const annualLeaveTotal = 21; // Standard annual leave days
    const annualLeaveBalance = annualLeaveTotal - annualLeaveUsed;

    res.status(200).json({
      success: true,
      data: {
        annualLeave: {
          total: annualLeaveTotal,
          used: annualLeaveUsed,
          balance: annualLeaveBalance
        },
        sickLeave: {
          used: sickLeaveUsed
        },
        recentLeaves: leaves.map(leave => ({
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          numberOfDays: leave.numberOfDays,
          status: leave.status
        }))
      }
    });

  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave balance',
      error: error.message
    });
  }
};

// // @desc    Get employee performance data
// // @route   GET /api/hr/employees/:id/performance
// // @access  Private (HR, Admin)
// exports.getEmployeePerformance = async (req, res) => {
//   try {
//     const employee = await User.findById(req.params.id);

//     if (!employee) {
//       return res.status(404).json({
//         success: false,
//         message: 'Employee not found'
//       });
//     }

//     // Fetch performance data from evaluation system
//     const QuarterlyEvaluation = require('../models/QuarterlyEvaluation');
//     const KPI = require('../models/QuarterlyKPI');

//     // Get latest evaluation
//     const latestEvaluation = await QuarterlyEvaluation.findOne({
//       employee: req.params.id,
//       status: { $in: ['submitted', 'reviewed'] }
//     }).sort('-evaluationDate');

//     // Get current quarter KPIs
//     const currentYear = new Date().getFullYear();
//     const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

//     const kpiData = await KPI.findOne({
//       employee: req.params.id,
//       year: currentYear,
//       quarter: currentQuarter,
//       approvalStatus: 'approved'
//     });

//     let kpiAchievement = null;
//     if (kpiData && kpiData.kpis) {
//       const totalWeight = kpiData.kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
//       const weightedAchievement = kpiData.kpis.reduce((sum, kpi) => {
//         return sum + ((kpi.achievement || 0) * kpi.weight / 100);
//       }, 0);

//       kpiAchievement = {
//         overallAchievement: Math.round(weightedAchievement),
//         totalKPIs: kpiData.kpis.length
//       };
//     }

//     res.status(200).json({
//       success: true,
//       data: {
//         latestEvaluation: latestEvaluation ? {
//           evaluationDate: latestEvaluation.evaluationDate,
//           overallScore: latestEvaluation.overallScore,
//           rating: latestEvaluation.rating
//         } : null,
//         kpiAchievement
//       }
//     });

//   } catch (error) {
//     console.error('Get performance error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch performance data',
//       error: error.message
//     });
//   }
// };

// @desc    Get employee performance data
// @route   GET /api/hr/employees/:id/performance
// @access  Private (HR, Admin, Supervisor)
exports.getEmployeePerformance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const employeeId = req.params.id;
    const user = await User.findById(userId);

    // Check authorization
    const isAdmin = ['admin', 'supply_chain', 'hr'].includes(user.role);
    const isSupervisor = user.role === 'supervisor';
    
    if (!isAdmin) {
      if (isSupervisor) {
        // Supervisors can only view their direct reports
        const supervisor = await User.findById(userId).populate('directReports', '_id');
        const isDirectReport = supervisor.directReports.some(
          report => report._id.toString() === employeeId
        );
        
        if (!isDirectReport && userId !== employeeId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only view performance data for your direct reports.'
          });
        }
      } else if (userId !== employeeId) {
        // Regular employees can only view their own
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own performance data.'
        });
      }
    }

    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Fetch all quarterly evaluations
    const QuarterlyEvaluation = require('../models/QuarterlyEvaluation');
    
    const evaluations = await QuarterlyEvaluation.find({
      employee: employeeId
    })
      .populate('supervisor', 'fullName email')
      .populate('quarterlyKPI')
      .populate('behavioralEvaluation')
      .sort({ createdAt: -1 });

    // Get latest evaluation
    const latestEvaluation = evaluations.length > 0 ? evaluations[0] : null;
    
    // Calculate average scores across all evaluations
    const avgFinalScore = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + (e.finalScore || 0), 0) / evaluations.length
      : 0;
    
    const avgTaskScore = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + (e.taskMetrics?.taskPerformanceScore || 0), 0) / evaluations.length
      : 0;
    
    const avgBehavioralScore = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + (e.behavioralScore || 0), 0) / evaluations.length
      : 0;

    // Group evaluations by grade
    const byGrade = evaluations.reduce((acc, e) => {
      if (e.grade) {
        acc[e.grade] = (acc[e.grade] || 0) + 1;
      }
      return acc;
    }, {});

    // Get current quarter KPI data if latest evaluation exists
    let currentQuarterKPI = null;
    if (latestEvaluation && latestEvaluation.quarterlyKPI) {
      const QuarterlyKPI = require('../models/QuarterlyKPI');
      currentQuarterKPI = await QuarterlyKPI.findById(latestEvaluation.quarterlyKPI);
    }

    // Calculate KPI achievement from latest evaluation
    let kpiAchievement = null;
    if (latestEvaluation && latestEvaluation.taskMetrics?.kpiAchievement) {
      const kpiData = latestEvaluation.taskMetrics.kpiAchievement;
      const totalWeight = kpiData.reduce((sum, kpi) => sum + kpi.kpiWeight, 0);
      const weightedAchievement = kpiData.reduce((sum, kpi) => sum + kpi.weightedScore, 0);

      kpiAchievement = {
        overallAchievement: Math.round(weightedAchievement),
        totalKPIs: kpiData.length,
        kpiBreakdown: kpiData.map(kpi => ({
          title: kpi.kpiTitle,
          weight: kpi.kpiWeight,
          tasksCompleted: kpi.tasksCompleted,
          averageGrade: kpi.averageGrade,
          achievedScore: kpi.achievedScore,
          weightedScore: kpi.weightedScore
        }))
      };
    }

    // Performance trends (last 4 quarters)
    const performanceTrend = evaluations.slice(0, 4).map(evaluation => ({
      quarter: evaluation.quarter,
      finalScore: evaluation.finalScore,
      grade: evaluation.grade,
      taskPerformance: evaluation.taskMetrics?.taskPerformanceScore || 0,
      behavioralScore: evaluation.behavioralScore,
      performanceLevel: evaluation.performanceLevel
    }));

    res.status(200).json({
      success: true,
      data: {
        latestEvaluation: latestEvaluation ? {
          id: latestEvaluation._id,
          evaluationDate: latestEvaluation.createdAt,
          quarter: latestEvaluation.quarter,
          overallScore: latestEvaluation.finalScore,
          rating: latestEvaluation.grade,
          performanceLevel: latestEvaluation.performanceLevel,
          status: latestEvaluation.status,
          taskPerformanceScore: latestEvaluation.taskMetrics?.taskPerformanceScore || 0,
          behavioralScore: latestEvaluation.behavioralScore,
          supervisor: latestEvaluation.supervisor ? {
            id: latestEvaluation.supervisor._id,
            name: latestEvaluation.supervisor.fullName
          } : null
        } : null,
        allEvaluations: evaluations.map(e => ({
          id: e._id,
          quarter: e.quarter,
          finalScore: e.finalScore,
          grade: e.grade,
          performanceLevel: e.performanceLevel,
          status: e.status,
          createdAt: e.createdAt
        })),
        averageScores: {
          finalScore: Math.round(avgFinalScore * 10) / 10,
          taskPerformance: Math.round(avgTaskScore * 10) / 10,
          behavioral: Math.round(avgBehavioralScore * 10) / 10
        },
        totalEvaluations: evaluations.length,
        byGrade,
        kpiAchievement,
        performanceTrend,
        currentQuarterKPI: currentQuarterKPI ? {
          quarter: currentQuarterKPI.quarter,
          status: currentQuarterKPI.approvalStatus,
          kpiCount: currentQuarterKPI.kpis?.length || 0
        } : null
      }
    });

  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance data',
      error: error.message
    });
  }
};

// @desc    Export employees to Excel
// @route   GET /api/hr/employees/export
// @access  Private (HR, Admin)
exports.exportEmployees = async (req, res) => {
  try {
    const {
      search = '',
      department = '',
      status = '',
      contractType = ''
    } = req.query;

    const query = { role: { $ne: 'supplier' } };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (department) query.department = department;
    if (status) query['employmentDetails.employmentStatus'] = status;
    if (contractType) query['employmentDetails.contractType'] = contractType;

    const employees = await User.find(query)
      .select('-password')
      .sort('fullName')
      .lean();

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');

    // Define columns
    worksheet.columns = [
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Position', key: 'position', width: 25 },
      { header: 'Contract Type', key: 'contractType', width: 20 },
      { header: 'Employment Status', key: 'employmentStatus', width: 20 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'Contract End Date', key: 'contractEndDate', width: 15 },
      { header: 'Salary', key: 'salary', width: 15 },
      { header: 'CNPS Number', key: 'cnpsNumber', width: 20 },
      { header: 'Taxpayer Number', key: 'taxPayerNumber', width: 20 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data rows
    employees.forEach(emp => {
      worksheet.addRow({
        employeeId: emp.employmentDetails?.employeeId || '',
        fullName: emp.fullName,
        email: emp.email,
        department: emp.department,
        position: emp.position,
        contractType: emp.employmentDetails?.contractType || '',
        employmentStatus: emp.employmentDetails?.employmentStatus || '',
        startDate: emp.employmentDetails?.startDate 
          ? new Date(emp.employmentDetails.startDate).toLocaleDateString()
          : '',
        contractEndDate: emp.employmentDetails?.contractEndDate 
          ? new Date(emp.employmentDetails.contractEndDate).toLocaleDateString()
          : '',
        salary: emp.employmentDetails?.salary?.amount 
          ? `${emp.employmentDetails.salary.currency} ${emp.employmentDetails.salary.amount}`
          : '',
        cnpsNumber: emp.employmentDetails?.governmentIds?.cnpsNumber || '',
        taxPayerNumber: emp.employmentDetails?.governmentIds?.taxPayerNumber || ''
      });
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=employees-${new Date().toISOString().split('T')[0]}.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export employees',
      error: error.message
    });
  }
};