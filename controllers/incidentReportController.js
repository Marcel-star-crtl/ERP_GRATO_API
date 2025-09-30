const IncidentReport = require('../models/IncidentReport');
const User = require('../models/User');
const { getApprovalChain } = require('../config/departmentStructure');
const { sendIncidentReportEmail, sendEmail } = require('../services/emailService');
const fs = require('fs');
const path = require('path');



const generateReportNumber = async () => {
  let reportNumber;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    reportNumber = `INC${year}${month}${day}-${hours}${minutes}-${random}`;
    
    // Check uniqueness
    const existing = await IncidentReport.findOne({ reportNumber });
    if (!existing) {
      return reportNumber;
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  throw new Error('Failed to generate unique report number');
}



// Create new incident report
const generateUniqueReportNumber = async () => {
  let reportNumber;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    reportNumber = `INC${year}${month}${day}-${hours}${minutes}-${random}`;
    
    // Check uniqueness
    const existing = await IncidentReport.findOne({ reportNumber });
    if (!existing) {
      return reportNumber;
    }
    
    attempts++;
    console.log(`Report number collision on attempt ${attempts}: ${reportNumber}`);
    
    // Small delay to avoid rapid collisions
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  throw new Error('Failed to generate unique report number after multiple attempts');
};

// Complete fixed createIncidentReport function
const createIncidentReport = async (req, res) => {
  try {
    console.log('=== CREATE INCIDENT REPORT STARTED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      title,
      incidentType,
      severity,
      description,
      location,
      specificLocation,
      incidentDate,
      incidentTime,
      weatherConditions,
      lightingConditions,
      injuriesReported,
      peopleInvolved,
      witnesses,
      injuryDetails,
      equipmentDetails,
      environmentalDetails,
      immediateActions,
      emergencyServicesContacted,
      supervisorNotified,
      supervisorName,
      notificationTime,
      contributingFactors,
      rootCause,
      preventiveMeasures,
      additionalComments,
      followUpRequired,
      reporterPhone
    } = req.body;

    if (!description || description.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Incident description must be at least 20 characters long'
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

    // Parse complex fields if they are strings
    let parsedInjuryDetails = null;
    let parsedEquipmentDetails = null;
    let parsedEnvironmentalDetails = null;
    let parsedPeopleInvolved = [];
    let parsedWitnesses = [];

    try {
      if (injuryDetails && typeof injuryDetails === 'string') {
        parsedInjuryDetails = JSON.parse(injuryDetails);
      } else if (injuryDetails) {
        parsedInjuryDetails = injuryDetails;
      }

      if (equipmentDetails && typeof equipmentDetails === 'string') {
        parsedEquipmentDetails = JSON.parse(equipmentDetails);
      } else if (equipmentDetails) {
        parsedEquipmentDetails = equipmentDetails;
      }

      if (environmentalDetails && typeof environmentalDetails === 'string') {
        parsedEnvironmentalDetails = JSON.parse(environmentalDetails);
      } else if (environmentalDetails) {
        parsedEnvironmentalDetails = environmentalDetails;
      }

      if (peopleInvolved) {
        parsedPeopleInvolved = typeof peopleInvolved === 'string' ? 
          peopleInvolved.split(',').map(p => p.trim()) : peopleInvolved;
      }

      if (witnesses) {
        parsedWitnesses = typeof witnesses === 'string' ? 
          witnesses.split(',').map(w => w.trim()) : witnesses;
      }
    } catch (error) {
      console.error('Error parsing complex fields:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid format for complex fields'
      });
    }

    // Generate approval chain based on employee name and department
    const approvalChain = getApprovalChain(employee.fullName, employee.department);
    console.log('Generated approval chain:', JSON.stringify(approvalChain, null, 2));

    if (!approvalChain || approvalChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine approval chain. Please contact HR for assistance.'
      });
    }

    // Process attachments if any
    let attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const fileName = `${Date.now()}-${file.originalname}`;
          const uploadDir = path.join(__dirname, '../uploads/incidents');
          const filePath = path.join(uploadDir, fileName);

          // Ensure directory exists
          await fs.promises.mkdir(uploadDir, { recursive: true });

          // Move file to permanent location
          if (file.path) {
            await fs.promises.rename(file.path, filePath);
          }

          attachments.push({
            name: file.originalname,
            url: `/uploads/incidents/${fileName}`,
            publicId: fileName,
            size: file.size,
            mimetype: file.mimetype
          });
        } catch (fileError) {
          console.error('Error processing file:', file.originalname, fileError);
        }
      }
    }

    // Generate report number manually as backup
    let generatedReportNumber;
    try {
      generatedReportNumber = await generateUniqueReportNumber();
      console.log('Manually generated report number:', generatedReportNumber);
    } catch (error) {
      console.error('Failed to generate report number:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate report number. Please try again.',
        error: error.message
      });
    }

    // Create the incident report with explicit report number
    const incidentReport = new IncidentReport({
      reportNumber: generatedReportNumber, // Explicitly set the report number
      employee: req.user.userId,
      title,
      department: employee.department,
      incidentType,
      severity,
      description,
      location,
      specificLocation,
      incidentDate: new Date(incidentDate),
      incidentTime,
      reportedDate: new Date(),
      weatherConditions,
      lightingConditions,
      injuriesReported: injuriesReported === 'yes' || injuriesReported === true,
      peopleInvolved: parsedPeopleInvolved,
      witnesses: parsedWitnesses,
      injuryDetails: parsedInjuryDetails,
      equipmentDetails: parsedEquipmentDetails,
      environmentalDetails: parsedEnvironmentalDetails,
      immediateActions,
      emergencyServicesContacted: emergencyServicesContacted === 'yes' || emergencyServicesContacted === true,
      supervisorNotified: supervisorNotified === 'yes' || supervisorNotified === true,
      supervisorName,
      notificationTime,
      contributingFactors,
      rootCause,
      preventiveMeasures,
      additionalComments,
      followUpRequired: followUpRequired === true,
      attachments,
      status: 'pending_supervisor',
      reportedBy: {
        employeeId: employee.employeeId || employee._id,
        fullName: employee.fullName,
        department: employee.department,
        email: employee.email,
        phone: reporterPhone
      },
      approvalChain: approvalChain.map(step => ({
        level: step.level,
        approver: {
          name: step.approver,
          email: step.email,
          role: step.role,
          department: step.department
        },
        status: 'pending',
        assignedDate: new Date()
      }))
    });

    // Log the incident report object before saving for debugging
    console.log('Incident report object before save:', {
      reportNumber: incidentReport.reportNumber,
      hasReportNumber: !!incidentReport.reportNumber,
      description: incidentReport.description,
      descriptionLength: incidentReport.description?.length,
      approvalChainCount: incidentReport.approvalChain.length,
      incidentType: incidentReport.incidentType,
      severity: incidentReport.severity
    });

    // Validate required fields before saving
    if (!incidentReport.reportNumber) {
      console.error('ERROR: Report number is still missing after manual generation');
      return res.status(500).json({
        success: false,
        message: 'Failed to generate report number. Please try again.',
        error: 'Report number generation failed'
      });
    }

    // Save the incident report with retry logic
    try {
      await incidentReport.save();
      console.log('Incident report saved successfully with ID:', incidentReport._id);
      console.log('Final report number:', incidentReport.reportNumber);
    } catch (saveError) {
      console.error('Error saving incident report:', saveError);
      
      // If it's a validation error related to reportNumber, try one more time
      if (saveError.message.includes('reportNumber') && saveError.message.includes('required')) {
        console.log('Attempting to fix missing reportNumber and retry save...');
        
        try {
          const newReportNumber = await generateUniqueReportNumber();
          incidentReport.reportNumber = newReportNumber;
          await incidentReport.save();
          console.log('Retry successful with report number:', newReportNumber);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          throw saveError; // Throw original error
        }
      } else {
        throw saveError; // Re-throw non-reportNumber errors
      }
    }

    // Populate employee details for response
    await incidentReport.populate('employee', 'fullName email department');

    // === ENHANCED EMAIL NOTIFICATIONS ===
    const notifications = [];
    console.log('=== STARTING EMAIL NOTIFICATIONS ===');

    // Get first approver (supervisor)
    const firstApprover = approvalChain[0];
    console.log('First approver details:', firstApprover);

    if (firstApprover && firstApprover.email) {
      console.log('Sending notification to first approver:', firstApprover.email);

      try {
        // Enhanced supervisor notification
        const supervisorNotification = await sendIncidentReportEmail.newIncidentToSupervisor(
          firstApprover.email,
          employee.fullName,
          incidentType,
          severity,
          incidentReport._id,
          incidentReport.injuriesReported,
          `${location} - ${specificLocation}`
        );

        console.log('Supervisor notification result:', supervisorNotification);
        notifications.push(Promise.resolve(supervisorNotification));

      } catch (error) {
        console.error('Failed to send supervisor notification:', error);
        notifications.push(Promise.resolve({ error, type: 'supervisor' }));
      }
    } else {
      console.log('No first approver found or email missing');
    }

    // Notify HR team about new incident report
    try {
      const hrTeam = await User.find({ role: 'hr' }).select('email fullName');
      console.log('Found HR team members:', hrTeam.map(h => ({ name: h.fullName, email: h.email })));

      if (hrTeam.length > 0) {
        const hrEmails = hrTeam.map(h => h.email);
        console.log('Sending HR notification to:', hrEmails);

        const hrNotification = await sendEmail({
          to: hrEmails,
          subject: `New Incident Report Submitted - ${employee.fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #52c41a; margin: 0;">New Incident Report Submitted</h2>
                <p style="color: #666; margin: 5px 0 0 0;">A new incident report has been submitted by ${employee.fullName}</p>
              </div>

              <div style="background-color: 'white'; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px;">
                <h3 style="color: #333; margin-top: 0;">Incident Summary</h3>
                <ul style="list-style: none; padding: 0;">
                  <li style="padding: 5px 0;"><strong>Report Number:</strong> ${incidentReport.reportNumber}</li>
                  <li style="padding: 5px 0;"><strong>Employee:</strong> ${employee.fullName} (${employee.department})</li>
                  <li style="padding: 5px 0;"><strong>Title:</strong> ${title}</li>
                  <li style="padding: 5px 0;"><strong>Type:</strong> ${incidentType}</li>
                  <li style="padding: 5px 0;"><strong>Severity:</strong> ${severity}</li>
                  <li style="padding: 5px 0;"><strong>Injuries:</strong> ${incidentReport.injuriesReported ? 'Yes' : 'No'}</li>
                  <li style="padding: 5px 0;"><strong>Location:</strong> ${location} - ${specificLocation}</li>
                  <li style="padding: 5px 0;"><strong>Status:</strong> Pending Approval</li>
                  <li style="padding: 5px 0;"><strong>Current Approver:</strong> ${firstApprover?.name} (${firstApprover?.email})</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/hr/incident-reports" 
                   style="background-color: #52c41a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View All Incident Reports
                </a>
              </div>
            </div>
          `
        });

        console.log('HR notification result:', hrNotification);
        notifications.push(Promise.resolve(hrNotification));
      }
    } catch (error) {
      console.error('Failed to send HR notification:', error);
      notifications.push(Promise.resolve({ error, type: 'hr' }));
    }

    // Notify admins about new incident report
    try {
      const admins = await User.find({ role: 'admin' }).select('email fullName');
      console.log('Found admins:', admins.map(a => ({ name: a.fullName, email: a.email })));

      if (admins.length > 0) {
        const adminEmails = admins.map(a => a.email);
        console.log('Sending admin notification to:', adminEmails);

        const adminNotification = await sendEmail({
          to: adminEmails,
          subject: `New Incident Report Submitted - ${employee.fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #856404; margin: 0;">New Incident Report Submitted</h2>
                <p style="color: #666; margin: 5px 0 0 0;">A new incident report has been submitted for administrative review</p>
              </div>

              <div style="background-color: 'white'; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px;">
                <h3 style="color: #333; margin-top: 0;">Incident Summary</h3>
                <ul style="list-style: none; padding: 0;">
                  <li style="padding: 5px 0;"><strong>Report Number:</strong> ${incidentReport.reportNumber}</li>
                  <li style="padding: 5px 0;"><strong>Employee:</strong> ${employee.fullName} (${employee.department})</li>
                  <li style="padding: 5px 0;"><strong>Title:</strong> ${title}</li>
                  <li style="padding: 5px 0;"><strong>Type:</strong> ${incidentType}</li>
                  <li style="padding: 5px 0;"><strong>Severity:</strong> ${severity}</li>
                  <li style="padding: 5px 0;"><strong>Injuries:</strong> ${incidentReport.injuriesReported ? 'Yes - Requires attention' : 'No'}</li>
                  <li style="padding: 5px 0;"><strong>Location:</strong> ${location}</li>
                  <li style="padding: 5px 0;"><strong>Status:</strong> Pending Supervisor Review</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/incident-reports" 
                   style="background-color: #856404; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View All Incident Reports
                </a>
              </div>
            </div>
          `
        });

        console.log('Admin notification result:', adminNotification);
        notifications.push(Promise.resolve(adminNotification));
      }
    } catch (error) {
      console.error('Failed to send admin notification:', error);
      notifications.push(Promise.resolve({ error, type: 'admin' }));
    }

    // Notify employee of successful submission
    try {
      console.log('Sending employee confirmation to:', employee.email);

      const employeeNotification = await sendEmail({
        to: employee.email,
        subject: 'Incident Report Submitted Successfully',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1890ff; margin: 0;">Incident Report Submitted</h2>
              <p style="color: #666; margin: 5px 0 0 0;">Your incident report has been successfully submitted and is now under review.</p>
            </div>

            <div style="background-color: 'white'; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #333; margin-top: 0;">Your Report Details</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="padding: 5px 0;"><strong>Report Number:</strong> ${incidentReport.reportNumber}</li>
                <li style="padding: 5px 0;"><strong>Title:</strong> ${title}</li>
                <li style="padding: 5px 0;"><strong>Status:</strong> Pending Approval</li>
                <li style="padding: 5px 0;"><strong>Current Reviewer:</strong> ${firstApprover?.name}</li>
              </ul>
            </div>

            <div style="background-color: #f0f8ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #333;"><strong>Next Steps:</strong> Your incident report is now in the review workflow. You will receive email notifications as it progresses through each review stage.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/employee/incident-reports" 
                 style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Track Your Reports
              </a>
            </div>

            <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
              <p style="margin: 0;">Thank you for reporting this incident and helping us maintain workplace safety!</p>
            </div>
          </div>
        `
      });

      console.log('Employee notification result:', employeeNotification);
      notifications.push(Promise.resolve(employeeNotification));

    } catch (error) {
      console.error('Failed to send employee notification:', error);
      notifications.push(Promise.resolve({ error, type: 'employee' }));
    }

    // Wait for all notifications to complete
    console.log('Waiting for all notifications to complete...');
    const notificationResults = await Promise.allSettled(notifications);

    // Log detailed results
    notificationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      } else if (result.value && result.value.error) {
        console.error(`${result.value.type} notification failed:`, result.value.error);
      } else {
        console.log(`Notification ${index} sent successfully`);
      }
    });

    const notificationStats = {
      sent: notificationResults.filter(r => r.status === 'fulfilled' && !r.value?.error).length,
      failed: notificationResults.filter(r => r.status === 'rejected' || r.value?.error).length
    };

    console.log('=== INCIDENT REPORT CREATED SUCCESSFULLY ===');
    console.log('Notification stats:', notificationStats);

    res.status(201).json({
      success: true,
      message: 'Incident report created successfully and sent for review',
      data: incidentReport,
      notifications: notificationStats
    });

  } catch (error) {
    console.error('Create incident report error:', error);

    // Clean up uploaded files if request failed
    if (req.files && req.files.length > 0) {
      await Promise.allSettled(
        req.files.map(file => {
          if (file.path) {
            return fs.promises.unlink(file.path).catch(e => console.error('File cleanup failed:', e));
          }
        })
      );
    }

    // Provide more specific error messages
    let errorMessage = 'Failed to create incident report';
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      errorMessage = `Validation failed: ${validationErrors.join(', ')}`;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
};


// Get employee's own incident reports
const getEmployeeIncidentReports = async (req, res) => {
  try {
    const reports = await IncidentReport.find({ employee: req.user.userId })
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });

  } catch (error) {
    console.error('Get employee incident reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incident reports',
      error: error.message
    });
  }
};

// Get single incident report details with approval chain
const getIncidentReportDetails = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await IncidentReport.findById(reportId)
      .populate('employee', 'fullName email department')
      .populate('supervisorReview.decidedBy', 'fullName email')
      .populate('hrReview.decidedBy', 'fullName email')
      .populate('investigation.investigator', 'fullName email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Incident report not found'
      });
    }

    // Check if user has permission to view this report
    const user = await User.findById(req.user.userId);
    const canView = 
      report.employee._id.equals(req.user.userId) || 
      user.role === 'admin' || 
      user.role === 'hr' || 
      report.approvalChain.some(step => step.approver.email === user.email); 

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Get incident report details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incident report details',
      error: error.message
    });
  }
};

// Get supervisor incident reports
const getSupervisorIncidentReports = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find reports where current user is in the approval chain and status is pending
    const reports = await IncidentReport.find({
      'approvalChain': {
        $elemMatch: {
          'approver.email': user.email,
          'status': 'pending'
        }
      },
      status: { $in: ['pending_supervisor'] }
    })
    .populate('employee', 'fullName email department')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });

  } catch (error) {
    console.error('Get supervisor incident reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incident reports',
      error: error.message
    });
  }
};

// Process supervisor decision
const processSupervisorDecision = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { decision, comments, actionsTaken, followUpRequired, followUpDate, escalationReason } = req.body;

    console.log('=== SUPERVISOR DECISION PROCESSING ===');
    console.log('Report ID:', reportId);
    console.log('Decision:', decision);

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const report = await IncidentReport.findById(reportId)
      .populate('employee', 'fullName email department');

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Incident report not found' 
      });
    }

    // Find current user's step in approval chain
    const currentStepIndex = report.approvalChain.findIndex(
      step => step.approver.email === user.email && step.status === 'pending'
    );

    if (currentStepIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to review this report or it has already been processed'
      });
    }

    // Update the approval step
    report.approvalChain[currentStepIndex].status = decision;
    report.approvalChain[currentStepIndex].comments = comments;
    report.approvalChain[currentStepIndex].actionDate = new Date();
    report.approvalChain[currentStepIndex].actionTime = new Date().toLocaleTimeString('en-GB');
    report.approvalChain[currentStepIndex].decidedBy = req.user.userId;

    // Update supervisor review
    report.supervisorReview = {
      decision,
      comments,
      actionsTaken,
      decisionDate: new Date(),
      decidedBy: req.user.userId,
      followUpRequired: followUpRequired === true,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      escalationReason
    };

    // Update overall report status based on decision
    if (decision === 'rejected') {
      report.status = 'rejected';
    } else if (decision === 'approved') {
      // Move to HR review
      report.status = 'pending_hr_review';
    } else if (decision === 'escalated') {
      report.status = 'pending_hr_review';
    }

    await report.save();

    // Send notifications based on decision
    const notifications = [];

    if (decision === 'approved' || decision === 'escalated') {
      // Notify HR team
      const hrTeam = await User.find({ role: 'hr' }).select('email fullName');

      if (hrTeam.length > 0) {
        notifications.push(
          sendIncidentReportEmail.supervisorDecisionToHR(
            hrTeam.map(h => h.email),
            report.employee.fullName,
            report.incidentType,
            report.severity,
            report._id,
            user.fullName,
            decision,
            comments
          ).catch(error => {
            console.error('Failed to send HR notification:', error);
            return { error, type: 'hr' };
          })
        );
      }

      // Notify employee of progress
      notifications.push(
        sendIncidentReportEmail.statusUpdateToEmployee(
          report.employee.email,
          report.reportNumber,
          decision === 'escalated' ? 'escalated' : 'approved',
          user.fullName,
          comments
        ).catch(error => {
          console.error('Failed to send employee notification:', error);
            return { error, type: 'employee' };
        })
      );

    } else {
      // Report was rejected - notify employee
      notifications.push(
        sendIncidentReportEmail.statusUpdateToEmployee(
          report.employee.email,
          report.reportNumber,
          'rejected',
          user.fullName,
          comments || 'Incident report rejected during supervisor review'
        ).catch(error => {
          console.error('Failed to send employee rejection notification:', error);
          return { error, type: 'employee' };
        })
      );
    }

    // Wait for all notifications
    const notificationResults = await Promise.allSettled(notifications);
    notificationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      } else if (result.value && result.value.error) {
        console.error(`${result.value.type} notification failed:`, result.value.error);
      } else {
        console.log(`Notification ${index} sent successfully`);
      }
    });

    console.log('=== SUPERVISOR DECISION PROCESSED ===');
    res.json({
      success: true,
      message: `Incident report ${decision} successfully`,
      data: report,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Process supervisor decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process decision',
      error: error.message
    });
  }
};

// Get HR incident reports
const getHRIncidentReports = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    let query = {};

    if (user.role === 'hr') {
      // HR users see reports assigned to them or pending HR review
      query = {
        $or: [
          { status: 'pending_hr_review' },
          { status: 'under_investigation' },
          { status: 'investigation_complete' },
          { status: 'resolved' },
          { 'hrReview.assignedOfficer': user.fullName }
        ]
      };
    } else if (user.role === 'admin') {
      // Admins see all HR-related reports
      query = {
        status: { $in: ['pending_hr_review', 'under_investigation', 'investigation_complete', 'resolved', 'rejected'] }
      };
    }

    const reports = await IncidentReport.find(query)
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });

  } catch (error) {
    console.error('Get HR incident reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch HR incident reports',
      error: error.message
    });
  }
};

// Process HR decision
const processHRDecision = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { decision, comments, investigationRequired, investigationDetails, assignedOfficer } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const report = await IncidentReport.findById(reportId)
      .populate('employee', 'fullName email department');

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Incident report not found' 
      });
    }

    // Update HR review
    report.hrReview = {
      decision,
      comments,
      decisionDate: new Date(),
      decidedBy: req.user.userId,
      investigationRequired: investigationRequired === true,
      investigationDetails,
      assignedOfficer
    };

    // Update overall report status based on decision
    if (decision === 'rejected') {
      report.status = 'rejected';
    } else if (decision === 'approved') {
      if (investigationRequired) {
        report.status = 'under_investigation';
        report.investigation = {
          required: true,
          status: 'pending',
          assignedDate: new Date(),
          assignedBy: req.user.userId,
          investigator: assignedOfficer ? await User.findOne({ fullName: assignedOfficer }) : null
        };
      } else {
        report.status = 'resolved';
        report.resolutionDate = new Date();
      }
    }

    await report.save();

    // Send notifications
    const notifications = [];

    // Notify employee of decision
    notifications.push(
      sendIncidentReportEmail.statusUpdateToEmployee(
        report.employee.email,
        report.reportNumber,
        decision,
        user.fullName,
        comments
      ).catch(error => {
        console.error('Failed to send employee notification:', error);
        return { error, type: 'employee' };
      })
    );

    // If investigation is required, notify assigned officer
    if (investigationRequired && assignedOfficer) {
      const investigator = await User.findOne({ fullName: assignedOfficer });
      if (investigator && investigator.email) {
        notifications.push(
          sendIncidentReportEmail.investigationAssigned(
            investigator.email,
            report.reportNumber,
            report.employee.fullName,
            report.incidentType,
            report._id
          ).catch(error => {
            console.error('Failed to send investigator notification:', error);
            return { error, type: 'investigator' };
          })
        );
      }
    }

    // Wait for all notifications
    const notificationResults = await Promise.allSettled(notifications);

    res.json({
      success: true,
      message: `HR decision processed successfully`,
      data: report,
      notifications: {
        sent: notificationResults.filter(r => r.status === 'fulfilled').length,
        failed: notificationResults.filter(r => r.status === 'rejected').length
      }
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

// Update investigation status
const updateInvestigationStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, findings, recommendations, completionDate } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const report = await IncidentReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Incident report not found' 
      });
    }

    // Check if user is authorized to update investigation
    if (!['hr', 'admin'].includes(user.role) && 
        (!report.investigation || report.investigation.investigator?.toString() !== req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update investigation
    report.investigation.status = status;
    report.investigation.findings = findings;
    report.investigation.recommendations = recommendations;
    
    if (status === 'completed') {
      report.investigation.completionDate = completionDate ? new Date(completionDate) : new Date();
      report.status = 'investigation_complete';
    }

    await report.save();

    res.json({
      success: true,
      message: 'Investigation status updated successfully',
      data: report
    });

  } catch (error) {
    console.error('Update investigation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update investigation status',
      error: error.message
    });
  }
};

// Get all incident reports (admin only)
const getAllIncidentReports = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!['admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { page = 1, limit = 10, status, department, incidentType } = req.query;
    
    let query = {};
    
    if (status) query.status = status;
    if (department) query.department = department;
    if (incidentType) query.incidentType = incidentType;

    const reports = await IncidentReport.find(query)
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await IncidentReport.countDocuments(query);

    res.json({
      success: true,
      data: reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get all incident reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incident reports',
      error: error.message
    });
  }
};

// Get approval chain preview
const getApprovalChainPreview = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const approvalChain = getApprovalChain(user.fullName, user.department);

    res.json({
      success: true,
      data: approvalChain
    });

  } catch (error) {
    console.error('Get approval chain preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval chain preview',
      error: error.message
    });
  }
};

// Get incident reports by role
const getIncidentReportsByRole = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    let query = {};

    switch (user.role) {
      case 'employee':
        query = { employee: req.user.userId };
        break;
      case 'supervisor':
        query = {
          'approvalChain.approver.email': user.email,
          status: { $in: ['pending_supervisor'] }
        };
        break;
      case 'hr':
        query = {
          status: { $in: ['pending_hr_review', 'under_investigation', 'investigation_complete'] }
        };
        break;
      case 'admin':
        // Admins can see all reports
        break;
      default:
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
    }

    const reports = await IncidentReport.find(query)
      .populate('employee', 'fullName email department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });

  } catch (error) {
    console.error('Get incident reports by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incident reports',
      error: error.message
    });
  }
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    let query = {};
    
    // Filter by role
    if (user.role === 'employee') {
      query.employee = req.user.userId;
    } else if (user.role === 'supervisor') {
      query['approvalChain.approver.email'] = user.email;
    }

    const [
      totalReports,
      pendingReports,
      resolvedReports,
      criticalIncidents
    ] = await Promise.all([
      IncidentReport.countDocuments(query),
      IncidentReport.countDocuments({ ...query, status: { $in: ['pending_supervisor', 'pending_hr_review'] } }),
      IncidentReport.countDocuments({ ...query, status: 'resolved' }),
      IncidentReport.countDocuments({ ...query, severity: 'critical' })
    ]);

    res.json({
      success: true,
      data: {
        totalReports,
        pendingReports,
        resolvedReports,
        criticalIncidents
      }
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

// Get incident report statistics
const getIncidentReportStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!['hr', 'admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const stats = await IncidentReport.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byStatus: { 
            $push: {
              status: '$status',
              count: 1
            }
          },
          byType: {
            $push: {
              type: '$incidentType',
              count: 1
            }
          },
          bySeverity: {
            $push: {
              severity: '$severity',
              count: 1
            }
          },
          byDepartment: {
            $push: {
              department: '$department',
              count: 1
            }
          }
        }
      },
      {
        $project: {
          total: 1,
          byStatus: {
            $arrayToObject: {
              $map: {
                input: "$byStatus",
                as: "s",
                in: { k: "$$s.status", v: { $sum: "$$s.count" } }
              }
            }
          },
          byType: {
            $arrayToObject: {
              $map: {
                input: "$byType",
                as: "t",
                in: { k: "$$t.type", v: { $sum: "$$t.count" } }
              }
            }
          },
          bySeverity: {
            $arrayToObject: {
              $map: {
                input: "$bySeverity",
                as: "sv",
                in: { k: "$$sv.severity", v: { $sum: "$$sv.count" } }
              }
            }
          },
          byDepartment: {
            $arrayToObject: {
              $map: {
                input: "$byDepartment",
                as: "d",
                in: { k: "$$d.department", v: { $sum: "$$d.count" } }
              }
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        total: 0,
        byStatus: {},
        byType: {},
        bySeverity: {},
        byDepartment: {}
      }
    });

  } catch (error) {
    console.error('Get incident report stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incident report statistics',
      error: error.message
    });
  }
};

// Additional helper functions for specific incident types
const getIncidentTypePriority = (incidentType, severity, hasInjuries) => {
  // Priority scoring for incident routing
  let priority = 0;

  // Base severity scores
  const severityScores = {
    'critical': 4,
    'high': 3,
    'medium': 2,
    'low': 1
  };

  // Type multipliers
  const typeMultipliers = {
    'injury': 2.0,
    'fire': 1.8,
    'environmental': 1.6,
    'security': 1.4,
    'equipment': 1.2,
    'near_miss': 1.0,
    'other': 0.8
  };

  priority = (severityScores[severity] || 1) * (typeMultipliers[incidentType] || 1);

  if (hasInjuries) {
    priority *= 1.5;
  }

  return Math.round(priority * 10) / 10;
};

// Get incident reports requiring immediate attention
const getUrgentIncidentReports = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    // Only HR, Admins, and Supervisors can view urgent reports
    if (!['hr', 'admin', 'supervisor'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    let query = {
      $or: [
        { severity: { $in: ['critical', 'high'] } },
        { injuriesReported: true },
        { incidentType: 'fire' },
        { incidentType: 'environmental' },
        { 
          createdAt: { 
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          },
          status: { $in: ['pending_supervisor', 'pending_hr_review'] }
        }
      ]
    };

    // Filter based on role
    if (user.role === 'supervisor') {
      query['approvalChain.approver.email'] = user.email;
      query['approvalChain.status'] = 'pending';
    } else if (user.role === 'hr') {
      query.status = { $in: ['pending_hr_review', 'under_investigation'] };
    }

    const urgentReports = await IncidentReport.find(query)
      .populate('employee', 'fullName email department')
      .sort({ 
        severity: { critical: 4, high: 3, medium: 2, low: 1 },
        createdAt: -1 
      })
      .limit(20);

    // Add priority scores
    const reportsWithPriority = urgentReports.map(report => ({
      ...report.toObject(),
      priorityScore: getIncidentTypePriority(
        report.incidentType,
        report.severity,
        report.injuresReported
      )
    }));

    res.json({
      success: true,
      data: reportsWithPriority,
      count: reportsWithPriority.length
    });

  } catch (error) {
    console.error('Get urgent incident reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch urgent incident reports',
      error: error.message
    });
  }
};

// Get incident reports analytics for specific periods
const getIncidentAnalytics = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    // Only HR and Admins can view detailed analytics
    if (!['hr', 'admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { period = 'monthly' } = req.query;
    
    // Calculate date range based on period
    let startDate = new Date();
    switch (period) {
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
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
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const [
      typeAnalytics,
      severityAnalytics,
      departmentAnalytics,
      trendAnalytics,
      complianceMetrics
    ] = await Promise.all([
      // Type analytics
      IncidentReport.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$incidentType',
            count: { $sum: 1 },
            injuryCount: { $sum: { $cond: ['$injuriesReported', 1, 0] } },
            resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            avgResolutionTime: { $avg: '$resolutionTime' }
          }
        }
      ]),

      // Severity analytics
      IncidentReport.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 },
            injuryRate: { $avg: { $cond: ['$injuriesReported', 1, 0] } }
          }
        }
      ]),

      // Department analytics
      IncidentReport.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
            criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            injuryCount: { $sum: { $cond: ['$injuriesReported', 1, 0] } }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Trend analytics (daily for the period)
      IncidentReport.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 },
            criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            injuryCount: { $sum: { $cond: ['$injuriesReported', 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),

      // Compliance metrics
      IncidentReport.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalReports: { $sum: 1 },
            reportedWithin24h: {
              $sum: {
                $cond: [
                  { $lte: [{ $subtract: ['$reportedDate', '$incidentDate'] }, 24 * 60 * 60 * 1000] },
                  1,
                  0
                ]
              }
            },
            supervisorNotifiedCount: { $sum: { $cond: ['$supervisorNotified', 1, 0] } },
            emergencyServicesCount: { $sum: { $cond: ['$emergencyServicesContacted', 1, 0] } },
            investigationRequiredCount: { $sum: { $cond: ['$investigation.required', 1, 0] } },
            investigationCompletedCount: {
              $sum: {
                $cond: [{ $eq: ['$investigation.status', 'completed'] }, 1, 0]
              }
            }
          }
        }
      ])
    ]);

    // Calculate compliance rates
    const compliance = complianceMetrics[0] || {};
    const complianceRates = {
      timelyReporting: compliance.totalReports > 0 ? 
        Math.round((compliance.reportedWithin24h / compliance.totalReports) * 100) : 0,
      supervisorNotification: compliance.totalReports > 0 ? 
        Math.round((compliance.supervisorNotifiedCount / compliance.totalReports) * 100) : 0,
      investigationCompletion: compliance.investigationRequiredCount > 0 ? 
        Math.round((compliance.investigationCompletedCount / compliance.investigationRequiredCount) * 100) : 0
    };

    res.json({
      success: true,
      data: {
        period,
        analytics: {
          byType: typeAnalytics,
          bySeverity: severityAnalytics,
          byDepartment: departmentAnalytics,
          trends: trendAnalytics,
          compliance: {
            ...compliance,
            rates: complianceRates
          }
        }
      }
    });

  } catch (error) {
    console.error('Get incident analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incident analytics',
      error: error.message
    });
  }
};

// Update incident report (for drafts or pending reports)
const updateIncidentReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const updateData = req.body;

    const report = await IncidentReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Incident report not found'
      });
    }

    // Check if user can update this report
    if (!report.employee.equals(req.user.userId) && !['admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow updates for pending supervisor reports
    if (!['pending_supervisor'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only update reports pending supervisor review'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'title', 'incidentType', 'severity', 'description', 'location',
      'specificLocation', 'incidentDate', 'incidentTime', 'weatherConditions',
      'lightingConditions', 'injuriesReported', 'peopleInvolved', 'witnesses',
      'injuryDetails', 'equipmentDetails', 'environmentalDetails',
      'immediateActions', 'emergencyServicesContacted', 'supervisorNotified',
      'supervisorName', 'notificationTime', 'contributingFactors',
      'rootCause', 'preventiveMeasures', 'additionalComments',
      'followUpRequired'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'injuriesReported' || field === 'emergencyServicesContacted' || 
            field === 'supervisorNotified' || field === 'followUpRequired') {
          report[field] = updateData[field] === 'yes' || updateData[field] === true;
        } else if (field === 'incidentDate' && updateData[field]) {
          report[field] = new Date(updateData[field]);
        } else if (['injuryDetails', 'equipmentDetails', 'environmentalDetails'].includes(field)) {
          try {
            report[field] = typeof updateData[field] === 'string' ? 
              JSON.parse(updateData[field]) : updateData[field];
          } catch (error) {
            // Keep existing data if parsing fails
          }
        } else if (['peopleInvolved', 'witnesses'].includes(field)) {
          report[field] = typeof updateData[field] === 'string' ? 
            updateData[field].split(',').map(p => p.trim()) : updateData[field];
        } else {
          report[field] = updateData[field];
        }
      }
    });

    await report.save();
    await report.populate('employee', 'fullName email department');

    res.json({
      success: true,
      message: 'Incident report updated successfully',
      data: report
    });

  } catch (error) {
    console.error('Update incident report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update incident report',
      error: error.message
    });
  }
};

// Delete incident report (only for pending supervisor status)
const deleteIncidentReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await IncidentReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Incident report not found'
      });
    }

    // Check permissions
    if (!report.employee.equals(req.user.userId) && !['admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of pending supervisor reports
    if (report.status !== 'pending_supervisor') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete reports pending supervisor review'
      });
    }

    // Clean up attachments if any
    if (report.attachments && report.attachments.length > 0) {
      await Promise.allSettled(
        report.attachments.map(attachment => {
          const filePath = path.join(__dirname, '../uploads/incidents', attachment.publicId);
          return fs.promises.unlink(filePath).catch(e => console.error('File cleanup failed:', e));
        })
      );
    }

    await IncidentReport.findByIdAndDelete(reportId);

    res.json({
      success: true,
      message: 'Incident report deleted successfully'
    });

  } catch (error) {
    console.error('Delete incident report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete incident report',
      error: error.message
    });
  }
};

// Add follow-up action to incident report
const addFollowUpAction = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, assignedTo, dueDate, notes } = req.body;

    const user = await User.findById(req.user.userId);
    const report = await IncidentReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Incident report not found'
      });
    }

    // Check permissions - only HR and Admin can add follow-up actions
    if (!['hr', 'admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Add new follow-up action
    const newAction = {
      action,
      assignedTo,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status: 'pending',
      notes
    };

    if (!report.followUpActions) {
      report.followUpActions = [];
    }

    report.followUpActions.push(newAction);
    await report.save();

    // Send notification to assigned person if email available
    const assignedUser = await User.findOne({ fullName: assignedTo });
    if (assignedUser) {
      await sendEmail({
        to: assignedUser.email,
        subject: `Follow-up Action Assigned - ${report.reportNumber}`,
        html: `
          <h3>Follow-up Action Assignment</h3>
          <p>You have been assigned a follow-up action for incident report ${report.reportNumber}.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Action:</strong> ${action}</p>
            ${dueDate ? `<p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>` : ''}
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          </div>
          
          <p>Please complete this action and update the status in the system.</p>
        `
      }).catch(console.error);
    }

    res.json({
      success: true,
      message: 'Follow-up action added successfully',
      data: report
    });

  } catch (error) {
    console.error('Add follow-up action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add follow-up action',
      error: error.message
    });
  }
};

// Update follow-up action status
const updateFollowUpAction = async (req, res) => {
  try {
    const { reportId, actionId } = req.params;
    const { status, notes } = req.body;

    const user = await User.findById(req.user.userId);
    const report = await IncidentReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Incident report not found'
      });
    }

    const actionIndex = report.followUpActions.findIndex(
      action => action._id.toString() === actionId
    );

    if (actionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up action not found'
      });
    }

    const action = report.followUpActions[actionIndex];

    // Check if user can update this action
    const canUpdate = 
      ['hr', 'admin'].includes(user.role) ||
      action.assignedTo === user.fullName;

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update action
    report.followUpActions[actionIndex].status = status;
    report.followUpActions[actionIndex].notes = notes;

    if (status === 'completed') {
      report.followUpActions[actionIndex].completedBy = req.user.userId;
      report.followUpActions[actionIndex].completedDate = new Date();
    }

    await report.save();

    res.json({
      success: true,
      message: 'Follow-up action updated successfully',
      data: report
    });

  } catch (error) {
    console.error('Update follow-up action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update follow-up action',
      error: error.message
    });
  }
};

module.exports = {
  // Core CRUD operations
  createIncidentReport,
  getIncidentReportDetails,
  updateIncidentReport,
  deleteIncidentReport,

  // Employee functions
  getEmployeeIncidentReports,

  // Supervisor functions
  getSupervisorIncidentReports,
  processSupervisorDecision,

  // HR functions
  getHRIncidentReports,
  processHRDecision,
  updateInvestigationStatus,

  // Admin functions
  getAllIncidentReports,

  // Utility functions
  getApprovalChainPreview,
  getIncidentReportsByRole,

  // Analytics and reporting
  getDashboardStats,
  getIncidentReportStats,
  getUrgentIncidentReports,
  getIncidentAnalytics,

  // Follow-up actions
  addFollowUpAction,
  updateFollowUpAction
};