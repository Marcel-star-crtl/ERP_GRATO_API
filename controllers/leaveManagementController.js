const Leave = require('../models/Leave');
const User = require('../models/User');
const { getApprovalChain } = require('../config/departmentStructure');
const { sendLeaveEmail } = require('../services/emailService');
const fs = require('fs');
const path = require('path');

// Helper function to calculate leave days
const calculateLeaveDays = (startDate, endDate, isPartialDay = false) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  
  return isPartialDay ? 0.5 : dayDiff;
};

// Helper function to determine leave category from type
const getLeaveCategory = (leaveType) => {
  const categoryMap = {
    // Medical
    'sick_leave': 'medical',
    'medical_appointment': 'medical',
    'emergency_medical': 'medical',
    'mental_health': 'medical',
    'medical_procedure': 'medical',
    'recovery_leave': 'medical',
    'chronic_condition': 'medical',
    
    // Vacation/Personal
    'annual_leave': 'vacation',
    'personal_time_off': 'personal',
    'floating_holiday': 'personal',
    'birthday_leave': 'personal',
    'wellness_day': 'personal',
    
    // Family
    'maternity_leave': 'maternity',
    'paternity_leave': 'paternity',
    'adoption_leave': 'family',
    'family_care': 'family',
    'child_sick_care': 'family',
    'elder_care': 'family',
    'parental_leave': 'family',
    
    // Emergency/Bereavement
    'emergency_leave': 'emergency',
    'bereavement_leave': 'bereavement',
    'funeral_leave': 'bereavement',
    'disaster_leave': 'emergency',
    
    // Study/Development
    'study_leave': 'study',
    'training_leave': 'study',
    'conference_leave': 'study',
    'examination_leave': 'study',
    
    // Special
    'sabbatical_leave': 'sabbatical',
    'compensatory_time': 'compensatory',
    'jury_duty': 'personal',
    'military_leave': 'personal',
    'volunteer_leave': 'personal',
    'unpaid_personal_leave': 'unpaid'
  };
  
  return categoryMap[leaveType] || 'personal';
};

// Create new leave request
const createLeave = async (req, res) => {
  try {
    console.log('=== CREATE LEAVE REQUEST STARTED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      leaveType,
      startDate,
      endDate,
      totalDays,
      isPartialDay,
      partialStartTime,
      partialEndTime,
      urgency,
      priority,
      reason,
      description,
      symptoms,
      doctorName,
      hospitalName,
      doctorContact,
      treatmentReceived,
      diagnosisCode,
      expectedRecoveryDate,
      isRecurring,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      emergencyContactAddress,
      workCoverage,
      returnToWorkPlan,
      additionalNotes,
      delegatedEmployees
    } = req.body;

    // Validate required fields
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Leave type, dates, and reason are required'
      });
    }

    if (!reason || reason.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Reason must be at least 10 characters long'
      });
    }

    // Get user details
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    console.log('Employee details:', {
      fullName: employee.fullName,
      department: employee.department,
      email: employee.email
    });

    // Determine leave category
    const leaveCategory = getLeaveCategory(leaveType);

    // Calculate total days if not provided
    const calculatedTotalDays = totalDays || calculateLeaveDays(startDate, endDate, isPartialDay);

    // Check leave balance for paid leaves
    if (!['unpaid_personal_leave', 'jury_duty', 'military_leave'].includes(leaveType)) {
      const leaveBalance = await Leave.calculateLeaveBalance(req.user.userId, leaveCategory);
      if (leaveBalance.remainingDays < calculatedTotalDays) {
        return res.status(400).json({
          success: false,
          message: `Insufficient ${leaveCategory} leave balance. You have ${leaveBalance.remainingDays} days remaining.`
        });
      }
    }

    // Generate approval chain
    const approvalChain = getApprovalChain(employee.fullName, employee.department, leaveCategory, calculatedTotalDays);
    console.log('Generated approval chain:', JSON.stringify(approvalChain, null, 2));

    if (!approvalChain || approvalChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine approval chain. Please contact HR for assistance.'
      });
    }

    // Process supporting documents
    let medicalCertificate = { provided: false };
    let supportingDocuments = [];

    if (req.files) {
      // Process medical certificate (for medical leaves)
      if (req.files.medicalCertificate && req.files.medicalCertificate.length > 0) {
        const certFile = req.files.medicalCertificate[0];
        try {
          const fileName = `${Date.now()}-${certFile.originalname}`;
          const uploadDir = path.join(__dirname, '../uploads/leave/certificates');
          const filePath = path.join(uploadDir, fileName);

          await fs.promises.mkdir(uploadDir, { recursive: true });

          if (certFile.path) {
            await fs.promises.rename(certFile.path, filePath);
          }

          medicalCertificate = {
            provided: true,
            fileName: certFile.originalname,
            url: `/uploads/leave/certificates/${fileName}`,
            publicId: fileName,
            uploadedAt: new Date()
          };
        } catch (fileError) {
          console.error('Error processing medical certificate:', fileError);
        }
      }

      // Process supporting documents
      if (req.files.supportingDocuments && req.files.supportingDocuments.length > 0) {
        for (const file of req.files.supportingDocuments) {
          try {
            const fileName = `${Date.now()}-${file.originalname}`;
            const uploadDir = path.join(__dirname, '../uploads/leave/documents');
            const filePath = path.join(uploadDir, fileName);

            await fs.promises.mkdir(uploadDir, { recursive: true });

            if (file.path) {
              await fs.promises.rename(file.path, filePath);
            }

            supportingDocuments.push({
              name: file.originalname,
              url: `/uploads/leave/documents/${fileName}`,
              publicId: fileName,
              size: file.size,
              mimetype: file.mimetype,
              uploadedAt: new Date()
            });
          } catch (fileError) {
            console.error('Error processing supporting document:', file.originalname, fileError);
          }
        }
      }
    }

    // Prepare leave data
    const leaveData = {
      employee: req.user.userId,
      leaveCategory,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalDays: calculatedTotalDays,
      isPartialDay: isPartialDay || false,
      partialStartTime,
      partialEndTime,
      urgency: urgency || 'medium',
      priority: priority || 'routine',
      reason,
      description,
      status: 'pending_supervisor',
      submittedBy: employee.email,
      submittedAt: new Date(),
      approvalChain: approvalChain.map(step => ({
        level: step.level,
        approver: {
          name: step.approver,
          email: step.email,
          role: step.role,
          department: step.department,
          userId: step.userId
        },
        status: 'pending',
        assignedDate: new Date()
      }))
    };

    // Add medical info for medical leaves
    if (leaveCategory === 'medical') {
      leaveData.medicalInfo = {
        symptoms,
        doctorDetails: {
          name: doctorName,
          hospital: hospitalName,
          contactNumber: doctorContact
        },
        treatmentReceived,
        diagnosisCode,
        expectedRecoveryDate: expectedRecoveryDate ? new Date(expectedRecoveryDate) : null,
        isRecurring: isRecurring || false,
        medicalCertificate
      };
    }

    // Add supporting documents
    if (supportingDocuments.length > 0) {
      leaveData.supportingDocuments = supportingDocuments;
    }

    // Add emergency contact
    if (emergencyContactName) {
      leaveData.emergencyContact = {
        name: emergencyContactName,
        phone: emergencyContactPhone,
        relationship: emergencyContactRelation,
        address: emergencyContactAddress
      };
    }

    // Add work coverage
    leaveData.workCoverage = workCoverage;
    leaveData.returnToWorkPlan = returnToWorkPlan;
    leaveData.additionalNotes = additionalNotes;

    // Add delegated employees
    if (delegatedEmployees && delegatedEmployees.length > 0) {
      leaveData.delegatedTo = delegatedEmployees.map(emp => ({
        employee: emp.employeeId,
        responsibilities: emp.responsibilities,
        contactInfo: emp.contactInfo
      }));
    }

    // Create the leave request
    const leave = new Leave(leaveData);
    await leave.save();
    console.log('Leave saved successfully with ID:', leave._id);

    // Populate employee details for response
    await leave.populate('employee', 'fullName email department');

    // === EMAIL NOTIFICATIONS ===
    const notifications = [];
    console.log('=== STARTING EMAIL NOTIFICATIONS ===');

    // Get first approver (supervisor)
    const firstApprover = approvalChain[0];
    console.log('First approver details:', firstApprover);

    if (firstApprover && firstApprover.email) {
      console.log('Sending notification to first approver:', firstApprover.email);

      try {
        const supervisorNotification = await sendLeaveEmail.newLeaveToSupervisor(
          firstApprover.email,
          employee.fullName,
          leave.leaveType,
          leave._id,
          calculatedTotalDays,
          urgency,
          reason,
          leaveCategory
        );

        console.log('Supervisor notification result:', supervisorNotification);
        notifications.push(Promise.resolve(supervisorNotification));

      } catch (error) {
        console.error('Failed to send supervisor notification:', error);
        notifications.push(Promise.resolve({ error, type: 'supervisor' }));
      }
    }

    // Notify HR team for certain leave types
    const hrNotificationTypes = ['medical', 'maternity', 'paternity', 'family', 'emergency', 'sabbatical'];
    if (hrNotificationTypes.includes(leaveCategory) || calculatedTotalDays > 3) {
      try {
        const hrTeam = await User.find({ role: 'hr' }).select('email fullName');
        console.log('Found HR team:', hrTeam.map(hr => ({ name: hr.fullName, email: hr.email })));

        for (const hr of hrTeam) {
          if (hr.email) {
            const hrNotification = sendLeaveEmail.newLeaveToHR(
              hr.email,
              employee.fullName,
              employee.department,
              leave.leaveType,
              leave._id,
              calculatedTotalDays,
              urgency,
              reason,
              leaveCategory
            ).catch(error => {
              console.error(`Failed to send HR notification to ${hr.email}:`, error);
              return { error, type: 'hr', email: hr.email };
            });

            notifications.push(hrNotification);
          }
        }
      } catch (error) {
        console.error('Error finding HR team:', error);
      }
    }

    // Wait for all notifications to complete
    const notificationResults = await Promise.allSettled(notifications);
    console.log('Email notification results:', notificationResults);

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: leave
    });

  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create leave request',
      error: error.message
    });
  }
};

// Get employee leaves
const getEmployeeLeaves = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const filter = { employee: req.user.userId };
    
    if (status) filter.status = status;
    if (category) filter.leaveCategory = category;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: 'employee'
    };
    
    const leaves = await Leave.paginate(filter, options);
    
    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Get employee leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests',
      error: error.message
    });
  }
};

// Get employee leave balance
const getEmployeeLeaveBalance = async (req, res) => {
  try {
    const balances = await Leave.calculateAllLeaveBalances(req.user.userId);
    
    res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    console.error('Get employee leave balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave balance',
      error: error.message
    });
  }
};

// Get single employee leave
const getEmployeeLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;
    
    const leave = await Leave.findOne({
      _id: leaveId,
      employee: req.user.userId
    }).populate('employee delegatedTo.employee');
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }
    
    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    console.error('Get employee leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave request',
      error: error.message
    });
  }
};

// Get supervisor leaves
const getSupervisorLeaves = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    
    // Find users who report to this supervisor
    const subordinates = await User.find({ 
      supervisor: req.user.userId 
    }).select('_id');
    
    const subordinateIds = subordinates.map(sub => sub._id);
    
    const filter = {
      employee: { $in: subordinateIds },
      status: { $in: ['pending_supervisor', 'approved_supervisor', 'rejected_supervisor'] }
    };
    
    if (status) filter.status = status;
    if (category) filter.leaveCategory = category;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: 'employee'
    };
    
    const leaves = await Leave.paginate(filter, options);
    
    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Get supervisor leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subordinate leave requests',
      error: error.message
    });
  }
};

// Process supervisor decision
const processSupervisorDecision = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { decision, comments } = req.body;
    
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be either "approve" or "reject"'
      });
    }
    
    const leave = await Leave.findById(leaveId).populate('employee');
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }
    
    // Check if user is the supervisor of the employee
    const employee = await User.findById(leave.employee._id);
    if (employee.supervisor.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the supervisor of this employee.'
      });
    }
    
    // Check if leave is in correct status
    if (leave.status !== 'pending_supervisor') {
      return res.status(400).json({
        success: false,
        message: 'Leave request is not pending supervisor approval'
      });
    }
    
    // Update leave status
    if (decision === 'approve') {
      leave.status = 'approved_supervisor';
      
      // Find next approver in chain
      const nextApprovalLevel = leave.approvalChain.find(
        level => level.status === 'pending'
      );
      
      if (nextApprovalLevel) {
        // Notify next approver
        try {
          await sendLeaveEmail.newLeaveToApprover(
            nextApprovalLevel.approver.email,
            leave.employee.fullName,
            leave.leaveType,
            leave._id,
            leave.totalDays,
            leave.urgency,
            leave.reason,
            leave.leaveCategory
          );
        } catch (error) {
          console.error('Failed to send notification to next approver:', error);
        }
      } else {
        // No more approvers, send to HR
        leave.status = 'pending_hr';
        
        // Notify HR team
        try {
          const hrTeam = await User.find({ role: 'hr' }).select('email');
          for (const hr of hrTeam) {
            await sendLeaveEmail.newLeaveToHR(
              hr.email,
              leave.employee.fullName,
              leave.employee.department,
              leave.leaveType,
              leave._id,
              leave.totalDays,
              leave.urgency,
              leave.reason,
              leave.leaveCategory
            );
          }
        } catch (error) {
          console.error('Failed to send HR notification:', error);
        }
      }
    } else {
      leave.status = 'rejected_supervisor';
      
      // Notify employee of rejection
      try {
        await sendLeaveEmail.leaveDecisionToEmployee(
          leave.employee.email,
          leave.leaveType,
          leave._id,
          'rejected',
          comments || 'Rejected by supervisor'
        );
      } catch (error) {
        console.error('Failed to send rejection notification:', error);
      }
    }
    
    // Update approval chain
    const supervisorApproval = leave.approvalChain.find(
      level => level.approver.userId === req.user.userId
    );
    
    if (supervisorApproval) {
      supervisorApproval.status = decision === 'approve' ? 'approved' : 'rejected';
      supervisorApproval.decisionDate = new Date();
      supervisorApproval.comments = comments;
    }
    
    leave.supervisorReview = {
      decision,
      comments,
      decisionDate: new Date(),
      decidedBy: req.user.userId
    };
    
    await leave.save();
    
    res.json({
      success: true,
      message: `Leave request ${decision}d successfully`,
      data: leave
    });
    
  } catch (error) {
    console.error('Process supervisor decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process supervisor decision',
      error: error.message
    });
  }
};

// Get HR leaves
const getHRLeaves = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    
    const filter = {
      status: { $in: ['pending_hr', 'approved_hr', 'rejected_hr', 'completed'] }
    };
    
    if (status) filter.status = status;
    if (category) filter.leaveCategory = category;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: 'employee'
    };
    
    const leaves = await Leave.paginate(filter, options);
    
    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Get HR leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch HR leave requests',
      error: error.message
    });
  }
};

// Process HR decision
const processHRDecision = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { decision, comments } = req.body;
    
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be either "approve" or "reject"'
      });
    }
    
    const leave = await Leave.findById(leaveId).populate('employee');
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }
    
    // Check if leave is in correct status
    if (leave.status !== 'pending_hr') {
      return res.status(400).json({
        success: false,
        message: 'Leave request is not pending HR approval'
      });
    }
    
    // Update leave status
    if (decision === 'approve') {
      leave.status = 'approved';
      
      // Notify employee of approval
      try {
        await sendLeaveEmail.leaveDecisionToEmployee(
          leave.employee.email,
          leave.leaveType,
          leave._id,
          'approved',
          comments || 'Approved by HR'
        );
      } catch (error) {
        console.error('Failed to send approval notification:', error);
      }
    } else {
      leave.status = 'rejected';
      
      // Notify employee of rejection
      try {
        await sendLeaveEmail.leaveDecisionToEmployee(
          leave.employee.email,
          leave.leaveType,
          leave._id,
          'rejected',
          comments || 'Rejected by HR'
        );
      } catch (error) {
        console.error('Failed to send rejection notification:', error);
      }
    }
    
    leave.hrReview = {
      decision,
      comments,
      decisionDate: new Date(),
      decidedBy: req.user.userId
    };
    
    await leave.save();
    
    res.json({
      success: true,
      message: `Leave request ${decision}d successfully`,
      data: leave
    });
    
  } catch (error) {
    console.error('Process HR decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process HR decision',
      error: error.message
    });
  }
};

// Get all leaves (admin only)
const getAllLeaves = async (req, res) => {
  try {
    const { status, category, department, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    
    if (status) filter.status = status;
    if (category) filter.leaveCategory = category;
    
    // Filter by department if specified
    if (department) {
      const employees = await User.find({ department }).select('_id');
      filter.employee = { $in: employees.map(emp => emp._id) };
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: 'employee'
    };
    
    const leaves = await Leave.paginate(filter, options);
    
    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all leave requests',
      error: error.message
    });
  }
};

// Get approval chain preview
const getApprovalChainPreview = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, isPartialDay } = req.query;
    
    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Leave type, start date, and end date are required'
      });
    }
    
    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    const leaveCategory = getLeaveCategory(leaveType);
    const totalDays = calculateLeaveDays(startDate, endDate, isPartialDay);
    
    const approvalChain = getApprovalChain(
      employee.fullName,
      employee.department,
      leaveCategory,
      totalDays
    );
    
    res.json({
      success: true,
      data: approvalChain
    });
    
  } catch (error) {
    console.error('Get approval chain preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate approval chain preview',
      error: error.message
    });
  }
};

// Get leaves by role
const getLeavesByRole = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    let filter = {};
    
    // Determine filter based on user role
    if (req.user.role === 'employee') {
      filter.employee = req.user.userId;
    } else if (req.user.role === 'supervisor') {
      // Find users who report to this supervisor
      const subordinates = await User.find({ 
        supervisor: req.user.userId 
      }).select('_id');
      
      const subordinateIds = subordinates.map(sub => sub._id);
      filter.employee = { $in: subordinateIds };
    }
    // For HR and admin, no additional filter needed
    
    if (status) filter.status = status;
    if (category) filter.leaveCategory = category;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: 'employee'
    };
    
    const leaves = await Leave.paginate(filter, options);
    
    res.json({
      success: true,
      data: leaves
    });
    
  } catch (error) {
    console.error('Get leaves by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests',
      error: error.message
    });
  }
};

// Save draft leave
const saveDraft = async (req, res) => {
  try {
    const {
      leaveType,
      startDate,
      endDate,
      totalDays,
      isPartialDay,
      partialStartTime,
      partialEndTime,
      urgency,
      priority,
      reason,
      description,
      symptoms,
      doctorName,
      hospitalName,
      doctorContact,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      emergencyContactAddress,
      workCoverage,
      returnToWorkPlan,
      additionalNotes
    } = req.body;

    // Validate required fields
    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Leave type and dates are required'
      });
    }

    const employee = await User.findById(req.user.userId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    // Determine leave category
    const leaveCategory = getLeaveCategory(leaveType);

    // Calculate total days if not provided
    const calculatedTotalDays = totalDays || calculateLeaveDays(startDate, endDate, isPartialDay);

    // Prepare leave data
    const leaveData = {
      employee: req.user.userId,
      leaveCategory,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalDays: calculatedTotalDays,
      isPartialDay: isPartialDay || false,
      partialStartTime,
      partialEndTime,
      urgency: urgency || 'medium',
      priority: priority || 'routine',
      reason,
      description,
      status: 'draft',
      submittedBy: employee.email,
      submittedAt: new Date()
    };

    // Add medical info for medical leaves
    if (leaveCategory === 'medical') {
      leaveData.medicalInfo = {
        symptoms,
        doctorDetails: {
          name: doctorName,
          hospital: hospitalName,
          contactNumber: doctorContact
        }
      };
    }

    // Add emergency contact
    if (emergencyContactName) {
      leaveData.emergencyContact = {
        name: emergencyContactName,
        phone: emergencyContactPhone,
        relationship: emergencyContactRelation,
        address: emergencyContactAddress
      };
    }

    // Add work coverage
    leaveData.workCoverage = workCoverage;
    leaveData.returnToWorkPlan = returnToWorkPlan;
    leaveData.additionalNotes = additionalNotes;

    // Check if updating existing draft
    if (req.params.leaveId) {
      const existingLeave = await Leave.findOne({
        _id: req.params.leaveId,
        employee: req.user.userId,
        status: 'draft'
      });

      if (existingLeave) {
        // Update existing draft
        const updatedLeave = await Leave.findByIdAndUpdate(
          req.params.leaveId,
          leaveData,
          { new: true, runValidators: true }
        ).populate('employee');

        return res.json({
          success: true,
          message: 'Draft leave request updated successfully',
          data: updatedLeave
        });
      }
    }

    // Create new draft
    const leave = new Leave(leaveData);
    await leave.save();
    await leave.populate('employee');

    res.status(201).json({
      success: true,
      message: 'Draft leave request saved successfully',
      data: leave
    });

  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save draft leave request',
      error: error.message
    });
  }
};

// Get dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    let stats = {};
    
    if (userRole === 'employee') {
      // Employee stats
      const pendingCount = await Leave.countDocuments({
        employee: userId,
        status: { $in: ['pending_supervisor', 'pending_hr'] }
      });
      
      const approvedCount = await Leave.countDocuments({
        employee: userId,
        status: 'approved'
      });
      
      const rejectedCount = await Leave.countDocuments({
        employee: userId,
        status: 'rejected'
      });
      
      const upcomingLeaves = await Leave.find({
        employee: userId,
        status: 'approved',
        startDate: { $gte: new Date() }
      }).sort({ startDate: 1 }).limit(5);
      
      stats = {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        upcomingLeaves
      };
      
    } else if (userRole === 'supervisor') {
      // Supervisor stats
      const subordinates = await User.find({ 
        supervisor: userId 
      }).select('_id');
      
      const subordinateIds = subordinates.map(sub => sub._id);
      
      const pendingApprovalCount = await Leave.countDocuments({
        employee: { $in: subordinateIds },
        status: 'pending_supervisor'
      });
      
      const teamOnLeave = await Leave.countDocuments({
        employee: { $in: subordinateIds },
        status: 'approved',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      });
      
      stats = {
        pendingApproval: pendingApprovalCount,
        teamOnLeave: teamOnLeave
      };
      
    } else if (['hr', 'admin'].includes(userRole)) {
      // HR/Admin stats
      const pendingHRCount = await Leave.countDocuments({
        status: 'pending_hr'
      });
      
      const pendingSupervisorCount = await Leave.countDocuments({
        status: 'pending_supervisor'
      });
      
      const onLeaveToday = await Leave.countDocuments({
        status: 'approved',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      });
      
      const monthlyLeaves = await Leave.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      stats = {
        pendingHR: pendingHRCount,
        pendingSupervisor: pendingSupervisorCount,
        onLeaveToday: onLeaveToday,
        monthlyLeaves: monthlyLeaves
      };
    }
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Update leave request
const updateLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const updateData = req.body;

    const leave = await Leave.findById(leaveId);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check permissions
    if (!leave.employee.equals(req.user.userId) && !['admin', 'hr'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow updates to draft or pending supervisor requests
    if (!['draft', 'pending_supervisor'].includes(leave.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only update draft or pending supervisor leave requests'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'leaveType', 'startDate', 'endDate', 'totalDays', 'isPartialDay',
      'partialStartTime', 'partialEndTime', 'urgency', 'priority', 'reason', 'description',
      'workCoverage', 'returnToWorkPlan', 'additionalNotes'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (['startDate', 'endDate'].includes(field) && updateData[field]) {
          leave[field] = new Date(updateData[field]);
        } else if (field === 'totalDays' && updateData[field]) {
          leave[field] = parseFloat(updateData[field]);
        } else {
          leave[field] = updateData[field];
        }
      }
    });

    // Update leave category if leave type changed
    if (updateData.leaveType) {
      leave.leaveCategory = getLeaveCategory(updateData.leaveType);
    }

    // Update medical info if provided (for medical leaves)
    if (leave.leaveCategory === 'medical') {
      if (updateData.symptoms || updateData.doctorName || updateData.hospitalName || updateData.doctorContact) {
        leave.medicalInfo = {
          ...leave.medicalInfo,
          symptoms: updateData.symptoms || leave.medicalInfo?.symptoms,
          doctorDetails: {
            name: updateData.doctorName || leave.medicalInfo?.doctorDetails?.name,
            hospital: updateData.hospitalName || leave.medicalInfo?.doctorDetails?.hospital,
            contactNumber: updateData.doctorContact || leave.medicalInfo?.doctorDetails?.contactNumber
          }
        };
      }
    }

    // Update emergency contact if provided
    if (updateData.emergencyContactName || updateData.emergencyContactPhone || updateData.emergencyContactRelation) {
      leave.emergencyContact = {
        name: updateData.emergencyContactName || leave.emergencyContact?.name,
        phone: updateData.emergencyContactPhone || leave.emergencyContact?.phone,
        relationship: updateData.emergencyContactRelation || leave.emergencyContact?.relationship,
        address: updateData.emergencyContactAddress || leave.emergencyContact?.address
      };
    }

    await leave.save();
    await leave.populate('employee', 'fullName email department');

    res.json({
      success: true,
      message: 'Leave request updated successfully',
      data: leave
    });

  } catch (error) {
    console.error('Update leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update leave request',
      error: error.message
    });
  }
};

// Delete draft leave
const deleteLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;

    const leave = await Leave.findById(leaveId);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check permissions
    if (!leave.employee.equals(req.user.userId) && !['admin', 'hr'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of draft leaves
    if (leave.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete draft leave requests'
      });
    }

    // Clean up attachments if any
    const cleanupPromises = [];
    
    if (leave.medicalInfo?.medicalCertificate?.url) {
      const filePath = path.join(__dirname, '../uploads/leave/certificates', leave.medicalInfo.medicalCertificate.publicId);
      cleanupPromises.push(fs.promises.unlink(filePath).catch(e => console.error('Certificate cleanup failed:', e)));
    }

    if (leave.supportingDocuments && leave.supportingDocuments.length > 0) {
      leave.supportingDocuments.forEach(doc => {
        const filePath = path.join(__dirname, '../uploads/leave/documents', doc.publicId);
        cleanupPromises.push(fs.promises.unlink(filePath).catch(e => console.error('Document cleanup failed:', e)));
      });
    }

    await Promise.allSettled(cleanupPromises);
    await Leave.findByIdAndDelete(leaveId);

    res.json({
      success: true,
      message: 'Draft leave request deleted successfully'
    });

  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete leave request',
      error: error.message
    });
  }
};

// Get leave analytics
const getLeaveAnalytics = async (req, res) => {
  try {
    const { period = 'quarterly', department, category } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 3);
    }

    let matchFilter = { createdAt: { $gte: startDate } };
    
    if (department) {
      const users = await User.find({ department }).select('_id');
      matchFilter.employee = { $in: users.map(u => u._id) };
    }

    if (category) {
      matchFilter.leaveCategory = category;
    }

    const analytics = await Leave.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            category: '$leaveCategory',
            type: '$leaveType'
          },
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' },
          avgDays: { $avg: '$totalDays' },
          approvedCount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['approved', 'completed']] },
                1,
                0
              ]
            }
          },
          urgentCount: {
            $sum: {
              $cond: [
                { $in: ['$urgency', ['high', 'critical']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          approvalRate: {
            $multiply: [
              { $divide: ['$approvedCount', '$count'] },
              100
            ]
          }
        }
      },
      { $sort: { totalDays: -1 } }
    ]);

    res.json({
      success: true,
      data: analytics,
      period: period
    });

  } catch (error) {
    console.error('Get leave analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave analytics',
      error: error.message
    });
  }
};

// Get leave trends
const getLeaveTrends = async (req, res) => {
  try {
    const { months = 12 } = req.query;

    const trends = await Leave.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            category: '$leaveCategory'
          },
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Get leave trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave trends',
      error: error.message
    });
  }
};

// Get HR analytics
const getHRAnalytics = async (req, res) => {
  try {
    const [
      totalLeaves,
      leavesByStatus,
      leavesByCategory,
      leavesByType,
      leavesByUrgency,
      departmentBreakdown,
      medicalCertificateStats
    ] = await Promise.all([
      // Total leaves this year
      Leave.countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
      }),

      // By status
      Leave.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalDays: { $sum: '$totalDays' }
          }
        }
      ]),

      // By category
      Leave.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
          }
        },
        {
          $group: {
            _id: '$leaveCategory',
            count: { $sum: 1 },
            totalDays: { $sum: '$totalDays' },
            avgDays: { $avg: '$totalDays' }
          }
        }
      ]),

      // By type
      Leave.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
          }
        },
        {
          $group: {
            _id: '$leaveType',
            count: { $sum: 1 },
            totalDays: { $sum: '$totalDays' },
            avgDays: { $avg: '$totalDays' }
          }
        }
      ]),

      // By urgency
      Leave.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
          }
        },
        {
          $group: {
            _id: '$urgency',
            count: { $sum: 1 }
          }
        }
      ]),

      // Department breakdown
      Leave.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        { $unwind: '$employeeData' },
        {
          $group: {
            _id: '$employeeData.department',
            count: { $sum: 1 },
            totalDays: { $sum: '$totalDays' }
          }
        }
      ]),

      // Medical certificate stats (for medical leaves)
      Leave.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) },
            leaveCategory: 'medical'
          }
        },
        {
          $group: {
            _id: '$medicalInfo.medicalCertificate.provided',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalLeaves,
          currentYear: new Date().getFullYear()
        },
        breakdown: {
          status: leavesByStatus,
          category: leavesByCategory,
          type: leavesByType,
          urgency: leavesByUrgency,
          department: departmentBreakdown,
          medicalCertificate: medicalCertificateStats
        }
      }
    });

  } catch (error) {
    console.error('Get HR analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch HR analytics',
      error: error.message
    });
  }
};

// Get leave statistics
const getLeaveStats = async (req, res) => {
  try {
    const { startDate, endDate, department, category, status } = req.query;

    let matchFilter = {};

    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }

    if (department) {
      const users = await User.find({ department }).select('_id');
      matchFilter.employee = { $in: users.map(u => u._id) };
    }

    if (category) {
      matchFilter.leaveCategory = category;
    }

    if (status) {
      matchFilter.status = status;
    }

    const stats = await Leave.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalLeaves: { $sum: 1 },
          totalDays: { $sum: '$totalDays' },
          avgDays: { $avg: '$totalDays' },
          statusBreakdown: { $push: '$status' },
          categoryBreakdown: { $push: '$leaveCategory' },
          typeBreakdown: { $push: '$leaveType' },
          urgencyBreakdown: { $push: '$urgency' }
        }
      }
    ]);

    // Process breakdowns
    let processedStats = {
      totalLeaves: 0,
      totalDays: 0,
      avgDays: 0,
      breakdown: {
        status: {},
        category: {},
        type: {},
        urgency: {}
      }
    };

    if (stats.length > 0) {
      const stat = stats[0];
      processedStats.totalLeaves = stat.totalLeaves;
      processedStats.totalDays = stat.totalDays || 0;
      processedStats.avgDays = Math.round(stat.avgDays || 0);

      // Count breakdowns
      stat.statusBreakdown.forEach(status => {
        processedStats.breakdown.status[status] = (processedStats.breakdown.status[status] || 0) + 1;
      });

      stat.categoryBreakdown.forEach(category => {
        processedStats.breakdown.category[category] = (processedStats.breakdown.category[category] || 0) + 1;
      });

      stat.typeBreakdown.forEach(type => {
        processedStats.breakdown.type[type] = (processedStats.breakdown.type[type] || 0) + 1;
      });

      stat.urgencyBreakdown.forEach(urgency => {
        processedStats.breakdown.urgency[urgency] = (processedStats.breakdown.urgency[urgency] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: processedStats
    });

  } catch (error) {
    console.error('Get leave stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave statistics',
      error: error.message
    });
  }
};

// Bulk approve leaves
const bulkApprove = async (req, res) => {
  try {
    const { leaveIds, comments } = req.body;
    
    if (!leaveIds || !Array.isArray(leaveIds)) {
      return res.status(400).json({
        success: false,
        message: 'Leave IDs array is required'
      });
    }

    const user = await User.findById(req.user.userId);
    const results = [];

    for (const leaveId of leaveIds) {
      try {
        const leave = await Leave.findById(leaveId).populate('employee', 'fullName email');
        
        if (leave) {
          leave.status = 'approved';
          leave.hrReview = {
            decision: 'approve',
            comments: comments || 'Bulk approved',
            decisionDate: new Date(),
            decidedBy: req.user.userId
          };
          
          await leave.save();
          results.push({ leaveId, status: 'approved', employee: leave.employee.fullName });
        }
      } catch (error) {
        results.push({ leaveId, status: 'failed', error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} leave requests`,
      data: results
    });

  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk approve leaves',
      error: error.message
    });
  }
};

// Bulk reject leaves
const bulkReject = async (req, res) => {
  try {
    const { leaveIds, comments } = req.body;
    
    if (!leaveIds || !Array.isArray(leaveIds)) {
      return res.status(400).json({
        success: false,
        message: 'Leave IDs array is required'
      });
    }

    const user = await User.findById(req.user.userId);
    const results = [];

    for (const leaveId of leaveIds) {
      try {
        const leave = await Leave.findById(leaveId).populate('employee', 'fullName email');
        
        if (leave) {
          leave.status = 'rejected';
          leave.hrReview = {
            decision: 'reject',
            comments: comments || 'Bulk rejected',
            decisionDate: new Date(),
            decidedBy: req.user.userId
          };
          
          await leave.save();
          results.push({ leaveId, status: 'rejected', employee: leave.employee.fullName });
        }
      } catch (error) {
        results.push({ leaveId, status: 'failed', error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} leave requests`,
      data: results
    });

  } catch (error) {
    console.error('Bulk reject error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk reject leaves',
      error: error.message
    });
  }
};

// Export all functions
module.exports = {
  createLeave,
  getEmployeeLeaves,
  getEmployeeLeaveBalance,
  getEmployeeLeave,
  getSupervisorLeaves,
  processSupervisorDecision,
  getHRLeaves,
  processHRDecision,
  getAllLeaves,
  getApprovalChainPreview,
  getLeavesByRole,
  saveDraft,
  getDashboardStats,
  updateLeave,
  deleteLeave,
  getLeaveAnalytics,
  getLeaveTrends,
  getHRAnalytics,
  getLeaveStats,
  bulkApprove,
  bulkReject
};


