const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Validate required environment variables
const validateEnv = () => {
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missingVars = requiredVars.filter(v => !process.env[v]);

  if (missingVars.length) {
    console.error('❌ Missing required email environment variables:', missingVars);
    throw new Error('Missing email configuration');
  }
};

// Create transporter with enhanced configuration
const createTransporter = () => {
  // Only validate when actually creating transporter (lazy validation)
  validateEnv();

  const config = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465', 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    // Enhanced connection settings
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    logger: true,
    debug: process.env.NODE_ENV !== 'production'
  };

  const transporter = nodemailer.createTransport(config);

  // Verify connection when transporter is created
  transporter.verify((error) => {
    if (error) {
      console.error('❌ SMTP Connection Error:', error);
    } else {
      console.log('✅ SMTP Connection Verified - Ready to send emails');
    }
  });

  return transporter;
};

// Lazy transporter creation - only create when needed
let _transporter = null;
const getTransporter = () => {
  if (!_transporter) {
    _transporter = createTransporter();
  }
  return _transporter;
};

/**
 * Enhanced email sending with retry logic
 * @param {Object} options - Email options
 * @param {number} [retries=3] - Number of retry attempts
 * @returns {Promise<Object>} - Result object
 */
const sendEmail = async (options, retries = 3) => {
  const mailOptions = {
    from: process.env.SMTP_FROM || `"Finance System" <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || generateHtmlFromText(options.text),
    attachments: options.attachments,
    // DKIM signing options would go here if needed
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📧 Attempt ${attempt}/${retries} to send email to ${options.to}`);
      const info = await getTransporter().sendMail(mailOptions);
      console.log('✅ Email sent successfully:', {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      });
      return { 
        success: true, 
        messageId: info.messageId,
        accepted: info.accepted,
        response: info.response 
      };
    } catch (error) {
      console.error(`❌ Email attempt ${attempt} failed:`, {
        error: error.message,
        code: error.code,
        command: error.command
      });
      
      if (attempt === retries) {
        return { 
          success: false, 
          error: error.message,
          code: error.code,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        };
      }
      
      // Exponential backoff
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Generate HTML template from plain text
 * @param {string} text - Plain text content
 * @returns {string} HTML content
 */
const generateHtmlFromText = (text) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
        <h2 style="color: #333; margin-top: 0;">Finance System Notification</h2>
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          ${text.replace(/\n/g, '<br>')}
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px; margin-bottom: 0;">
          This is an automated message from the Finance Management System. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;
};

/**
 * Cash Request Email Templates
 */
const sendCashRequestEmail = {
  /**
   * Notify supervisor of new request with approval link
   * @param {string} supervisorEmail 
   * @param {string} employeeName 
   * @param {number} amount 
   * @param {string} requestId 
   * @param {string} [purpose] - Request purpose
   * @returns {Promise<Object>} 
   */
  newRequestToSupervisor: async (supervisorEmail, employeeName, amount, requestId, purpose = '') => {
    try {
      // Validate inputs
      if (!supervisorEmail || !employeeName || amount == null || !requestId) {
        throw new Error('Missing required parameters for supervisor email');
      }

      const formattedAmount = Number(amount).toFixed(2);
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const approvalLink = `${clientUrl}/supervisor/request/${requestId}`;
      
      const subject = '🔔 New Cash Request Approval Needed';
      const text = `Hello,\n\nYou have received a new cash request that requires your approval.\n\nEmployee: ${employeeName}\nAmount Requested: XAF ${formattedAmount}\nRequest ID: REQ-${requestId.toString().slice(-6).toUpperCase()}\n${purpose ? `Purpose: ${purpose}\n` : ''}\nPlease click this link to review: ${approvalLink}\n\nBest regards,\nFinance System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #333; margin-top: 0;">🔔 Cash Request Approval Needed</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Supervisor,
            </p>
            <p style="color: #555; line-height: 1.6;">
              You have received a new cash request that requires your approval.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Amount Requested:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold;">XAF ${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requestId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${purpose ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Purpose:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${purpose}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">AWAITING YOUR APPROVAL</span></td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalLink}" 
                 style="display: inline-block; background-color: #28a745; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                👀 Review & Process Request
              </a>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${approvalLink}" style="color: #007bff; text-decoration: none;">${approvalLink}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Finance Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: supervisorEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in newRequestToSupervisor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify finance team when supervisor approves
   * @param {Array|string} financeEmails 
   * @param {string} employeeName 
   * @param {number} amount 
   * @param {string} requestId 
   * @param {string} [supervisorComments]
   * @returns {Promise<Object>} 
   */
  supervisorApprovalToFinance: async (financeEmails, employeeName, amount, requestId, supervisorComments = '') => {
    try {
      const formattedAmount = Number(amount).toFixed(2);
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const financeLink = `${clientUrl}/finance/request/${requestId}`;
      
      const subject = '💰 Cash Request Ready for Finance Approval';
      const text = `Hello Finance Team,\n\nA cash request has been approved by the supervisor and requires your final approval.\n\nEmployee: ${employeeName}\nAmount Approved: XAF ${formattedAmount}\nRequest ID: REQ-${requestId.toString().slice(-6).toUpperCase()}\n${supervisorComments ? `Supervisor Comments: ${supervisorComments}\n` : ''}Please click this link to review: ${financeLink}\n\nBest regards,\nFinance System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8;">
            <h2 style="color: #333; margin-top: 0;">💰 Cash Request Ready for Finance Approval</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Finance Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              A cash request has been <strong style="color: #28a745;">approved by the supervisor</strong> and is now ready for your final review and processing.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #17a2b8; padding-bottom: 10px;">Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Approved Amount:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold;">XAF ${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requestId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${supervisorComments ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Supervisor Notes:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-style: italic;">${supervisorComments}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ SUPERVISOR APPROVED</span></td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${financeLink}" 
                 style="display: inline-block; background-color: #17a2b8; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                💼 Review & Process Payment
              </a>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${financeLink}" style="color: #007bff; text-decoration: none;">${financeLink}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Finance Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: financeEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in supervisorApprovalToFinance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Legacy method - kept for backward compatibility
   */
  approvedToFinance: async (financeEmail, employeeName, amount, requestId) => {
    return await sendCashRequestEmail.supervisorApprovalToFinance(financeEmail, employeeName, amount, requestId);
  },

  /**
   * Notify employee of approval
   * @param {string} employeeEmail 
   * @param {number} amount 
   * @param {string} requestId 
   * @param {string} [supervisorName]
   * @param {string} [comments]
   * @returns {Promise<Object>}
   */
  approvalToEmployee: async (employeeEmail, amount, requestId, supervisorName = '', comments = '') => {
    try {
      const formattedAmount = Number(amount).toFixed(2);
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/request/${requestId}`;
      
      const subject = '🎉 Your Cash Request Has Been Approved!';
      const text = `Congratulations!\n\nYour cash request has been approved and is being processed.\n\nAmount Approved: XAF ${formattedAmount}\nRequest ID: REQ-${requestId.toString().slice(-6).toUpperCase()}\n${supervisorName ? `Approved by: ${supervisorName}\n` : ''}${comments ? `Comments: ${comments}\n` : ''}\nTrack your request: ${trackingLink}\n\nPlease collect your cash from the finance department during business hours.\n\nBest regards,\nFinance Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h2 style="color: #155724; margin-top: 0;">🎉 Congratulations! Your Request is Approved</h2>
            <p style="color: #155724; line-height: 1.6; font-size: 16px;">
              Great news! Your cash request has been approved and is now being processed for payment.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Approval Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Approved Amount:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold; font-size: 18px;">XAF ${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requestId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${supervisorName ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Approved by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${supervisorName}</td>
                </tr>
                ` : ''}
                ${comments ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Comments:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-style: italic;">${comments}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ APPROVED</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h4 style="color: #856404; margin-top: 0;">📋 Next Steps:</h4>
              <ul style="color: #856404; margin: 0; padding-left: 20px;">
                <li>Your request is now with the finance team for final processing</li>
                <li>You will receive another notification when payment is ready</li>
                <li>Please collect your cash from the finance department during business hours</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #007bff; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 Track Your Request
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #c3e6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Finance Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in approvalToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of denial
   * @param {string} employeeEmail 
   * @param {string} reason 
   * @param {string} requestId 
   * @param {string} [deniedBy]
   * @returns {Promise<Object>}
   */
  denialToEmployee: async (employeeEmail, reason, requestId, deniedBy = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/request/${requestId}`;
      
      const subject = '📋 Cash Request Status Update';
      const text = `Hello,\n\nWe regret to inform you that your cash request has not been approved.\n\nRequest ID: REQ-${requestId.toString().slice(-6).toUpperCase()}\nReason: ${reason}\n${deniedBy ? `Reviewed by: ${deniedBy}\n` : ''}\nView details: ${trackingLink}\n\nIf you have any questions, please contact your supervisor or the finance department.\n\nBest regards,\nFinance Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
            <h2 style="color: #721c24; margin-top: 0;">📋 Cash Request Status Update</h2>
            <p style="color: #721c24; line-height: 1.6;">
              We regret to inform you that your cash request has not been approved at this time.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requestId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><span style="background-color: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">❌ NOT APPROVED</span></td>
                </tr>
                ${deniedBy ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Reviewed by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deniedBy}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Reason:</strong></td>
                  <td style="padding: 8px 0; font-style: italic; color: #721c24;">${reason}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <h4 style="color: #0c5460; margin-top: 0;">💡 What You Can Do:</h4>
              <ul style="color: #0c5460; margin: 0; padding-left: 20px;">
                <li>Review the reason for denial above</li>
                <li>Contact your supervisor for clarification</li>
                <li>Submit a new request if circumstances change</li>
                <li>Reach out to the finance department if you have questions</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #6c757d; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 View Request Details
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #f5c6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Finance Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in denialToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify finance team of justification submission
   * @param {Array|string} financeEmails 
   * @param {string} employeeName 
   * @param {number} amountSpent 
   * @param {number} balanceReturned 
   * @param {string} requestId 
   * @returns {Promise<Object>}
   */
  justificationToFinance: async (financeEmails, employeeName, amountSpent, balanceReturned, requestId) => {
    try {
      const formattedSpent = Number(amountSpent).toFixed(2);
      const formattedReturned = Number(balanceReturned).toFixed(2);
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/finance/request/${requestId}`;
      
      const subject = '📄 Cash Justification Submitted for Review';
      const text = `Hello Finance Team,\n\nAn employee has submitted their cash justification for review.\n\nEmployee: ${employeeName}\nRequest ID: REQ-${requestId.toString().slice(-6).toUpperCase()}\nAmount Spent: XAF ${formattedSpent}\nBalance Returned: XAF ${formattedReturned}\n\nReview justification: ${reviewLink}\n\nPlease review the justification documentation in the finance system.\n\nBest regards,\nFinance System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #e2e3e5; padding: 20px; border-radius: 8px; border-left: 4px solid #6c757d;">
            <h2 style="color: #333; margin-top: 0;">📄 Cash Justification Submitted</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Finance Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              <strong>${employeeName}</strong> has submitted justification documentation for their completed cash request.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #6c757d; padding-bottom: 10px;">Justification Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requestId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Amount Spent:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #dc3545; font-weight: bold;">XAF ${formattedSpent}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Balance Returned:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold;">XAF ${formattedReturned}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ COMPLETED</span></td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" 
                 style="display: inline-block; background-color: #6c757d; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                📋 Review Justification Documents
              </a>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${reviewLink}" style="color: #007bff; text-decoration: none;">${reviewLink}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Finance Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: financeEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in justificationToFinance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee when payment is disbursed
   * @param {string} employeeEmail 
   * @param {number} amount 
   * @param {string} requestId 
   * @param {string} [disbursedBy]
   * @returns {Promise<Object>}
   */
  disbursementToEmployee: async (employeeEmail, amount, requestId, disbursedBy = '') => {
    try {
      const formattedAmount = Number(amount).toFixed(2);
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const justificationLink = `${clientUrl}/employee/request/${requestId}/justify`;
      
      const subject = '💰 Cash Request Payment Ready for Collection';
      const text = `Hello,\n\nGreat news! Your cash request has been processed and payment is ready for collection.\n\nAmount: XAF ${formattedAmount}\nRequest ID: REQ-${requestId.toString().slice(-6).toUpperCase()}\n${disbursedBy ? `Processed by: ${disbursedBy}\n` : ''}\nSubmit justification: ${justificationLink}\n\nIMPORTANT: Please collect your cash from the finance department and remember to submit your justification after spending.\n\nBest regards,\nFinance Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h2 style="color: #155724; margin-top: 0;">💰 Payment Ready for Collection!</h2>
            <p style="color: #155724; line-height: 1.6; font-size: 16px;">
              Excellent news! Your cash request has been fully processed and approved for payment.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Payment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Amount Available:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold; font-size: 18px;">XAF ${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requestId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${disbursedBy ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Processed by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${disbursedBy}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #17a2b8; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">💰 READY FOR COLLECTION</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h4 style="color: #856404; margin-top: 0;">📋 Important Next Steps:</h4>
              <ol style="color: #856404; margin: 0; padding-left: 20px;">
                <li><strong>Collect your cash</strong> from the finance department during business hours</li>
                <li><strong>Keep all receipts</strong> for expenses related to this request</li>
                <li><strong>Submit justification</strong> within the required timeframe after spending</li>
                <li><strong>Return any unused balance</strong> to the finance department</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${justificationLink}" 
                 style="display: inline-block; background-color: #ffc107; color: #333; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; border: 2px solid #ffc107;">
                📝 Submit Justification (Later)
              </a>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Justification Link:</strong> <a href="${justificationLink}" style="color: #007bff; text-decoration: none;">${justificationLink}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #c3e6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Finance Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in disbursementToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Send general notification email
   * @param {Array|string} recipients 
   * @param {string} subject 
   * @param {string} message 
   * @param {string} [type='info'] - Type: 'info', 'success', 'warning', 'error'
   * @returns {Promise<Object>}
   */
  sendNotification: async (recipients, subject, message, type = 'info') => {
    try {
      const typeStyles = {
        info: { color: '#007bff', bg: '#d1ecf1', border: '#17a2b8' },
        success: { color: '#28a745', bg: '#d4edda', border: '#28a745' },
        warning: { color: '#ffc107', bg: '#fff3cd', border: '#ffc107' },
        error: { color: '#dc3545', bg: '#f8d7da', border: '#dc3545' }
      };

      const style = typeStyles[type] || typeStyles.info;
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${style.bg}; padding: 20px; border-radius: 8px; border-left: 4px solid ${style.border};">
            <h2 style="color: #333; margin-top: 0;">${subject}</h2>
            <div style="color: #555; line-height: 1.6;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Finance Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: recipients,
        subject,
        text: message,
        html
      });

    } catch (error) {
      console.error('❌ Error in sendNotification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};


/**
 * Purchase Requisition Email Templates
 */
 const sendPurchaseRequisitionEmail = {
  /**
   * Notify supervisor of new requisition with approval link
   * @param {string} supervisorEmail 
   * @param {string} employeeName 
   * @param {string} title
   * @param {string} requisitionId 
   * @param {number} itemCount
   * @param {number} [budget] - Estimated budget
   * @returns {Promise<Object>} 
   */
  newRequisitionToSupervisor: async (supervisorEmail, employeeName, title, requisitionId, itemCount, budget = null) => {
    try {
      // Validate inputs
      if (!supervisorEmail || !employeeName || !title || !requisitionId) {
        throw new Error('Missing required parameters for supervisor email');
      }

      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const approvalLink = `${clientUrl}/supervisor/requisition/${requisitionId}`;
      
      const subject = '🛒 New Purchase Requisition Approval Needed';
      const text = `Hello,\n\nYou have received a new purchase requisition that requires your approval.\n\nEmployee: ${employeeName}\nTitle: ${title}\nItems: ${itemCount}\nRequisition ID: REQ-${requisitionId.toString().slice(-6).toUpperCase()}\n${budget ? `Budget: XAF ${budget.toFixed(2)}\n` : ''}\nPlease click this link to review: ${approvalLink}\n\nBest regards,\nProcurement System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #333; margin-top: 0;">🛒 Purchase Requisition Approval Needed</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Supervisor,
            </p>
            <p style="color: #555; line-height: 1.6;">
              You have received a new purchase requisition that requires your approval.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">Requisition Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Items Count:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${itemCount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Requisition ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requisitionId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${budget ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Estimated Budget:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold;">XAF ${budget.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">AWAITING YOUR APPROVAL</span></td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalLink}" 
                 style="display: inline-block; background-color: #28a745; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                📋 Review & Process Requisition
              </a>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${approvalLink}" style="color: #007bff; text-decoration: none;">${approvalLink}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Procurement Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: supervisorEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in newRequisitionToSupervisor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify supply chain team when supervisor approves
   * @param {Array|string} supplyChainEmails 
   * @param {string} employeeName 
   * @param {string} title
   * @param {string} requisitionId 
   * @param {number} itemCount
   * @param {number} [budget] - Estimated budget
   * @returns {Promise<Object>} 
   */
  supervisorApprovalToSupplyChain: async (supplyChainEmails, employeeName, title, requisitionId, itemCount, budget = null) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/supply-chain/requisition/${requisitionId}`;
      
      const subject = '📦 Purchase Requisition Ready for Supply Chain Review';
      const text = `Hello Supply Chain Team,\n\nA purchase requisition has been approved by the supervisor and requires your review.\n\nEmployee: ${employeeName}\nTitle: ${title}\nItems: ${itemCount}\nRequisition ID: REQ-${requisitionId.toString().slice(-6).toUpperCase()}\n${budget ? `Budget: XAF ${budget.toFixed(2)}\n` : ''}\nPlease click this link to review: ${reviewLink}\n\nBest regards,\nProcurement System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8;">
            <h2 style="color: #333; margin-top: 0;">📦 Purchase Requisition Ready for Review</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Supply Chain Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              A purchase requisition has been <strong style="color: #28a745;">approved by the supervisor</strong> and is now ready for your review and procurement planning.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #17a2b8; padding-bottom: 10px;">Requisition Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Items Count:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${itemCount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Requisition ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requisitionId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${budget ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Estimated Budget:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold;">XAF ${budget.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ SUPERVISOR APPROVED</span></td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" 
                 style="display: inline-block; background-color: #17a2b8; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                📊 Review & Process Requisition
              </a>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${reviewLink}" style="color: #007bff; text-decoration: none;">${reviewLink}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Procurement Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: supplyChainEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in supervisorApprovalToSupplyChain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify finance team when supply chain approves
   * @param {Array|string} financeEmails 
   * @param {string} employeeName 
   * @param {string} title
   * @param {string} requisitionId 
   * @param {number} estimatedCost
   * @param {string} [supplyChainComments]
   * @returns {Promise<Object>}
   */
  supplyChainApprovalToFinance: async (financeEmails, employeeName, title, requisitionId, estimatedCost, supplyChainComments = '') => {
    try {
      const formattedCost = Number(estimatedCost).toFixed(2);
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const financeLink = `${clientUrl}/finance/requisition/${requisitionId}`;
      
      const subject = '💰 Purchase Requisition Ready for Finance Approval';
      const text = `Hello Finance Team,\n\nA purchase requisition has been approved by supply chain and requires your final approval.\n\nEmployee: ${employeeName}\nTitle: ${title}\nEstimated Cost: XAF ${formattedCost}\nRequisition ID: REQ-${requisitionId.toString().slice(-6).toUpperCase()}\n${supplyChainComments ? `Supply Chain Comments: ${supplyChainComments}\n` : ''}\nPlease click this link to review: ${financeLink}\n\nBest regards,\nProcurement System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8;">
            <h2 style="color: #333; margin-top: 0;">💰 Purchase Requisition Ready for Finance Approval</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Finance Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              A purchase requisition has been <strong style="color: #28a745;">approved by supply chain</strong> and is now ready for your final approval and budget authorization.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #17a2b8; padding-bottom: 10px;">Requisition Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Estimated Cost:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold;">XAF ${formattedCost}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Requisition ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requisitionId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${supplyChainComments ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Supply Chain Notes:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-style: italic;">${supplyChainComments}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ SUPPLY CHAIN APPROVED</span></td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${financeLink}" 
                 style="display: inline-block; background-color: #17a2b8; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                💼 Review & Approve Budget
              </a>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${financeLink}" style="color: #007bff; text-decoration: none;">${financeLink}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Procurement Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: financeEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in supplyChainApprovalToFinance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of approval
   * @param {string} employeeEmail 
   * @param {string} title
   * @param {string} requisitionId 
   * @param {string} [approverName]
   * @param {string} [comments]
   * @returns {Promise<Object>}
   */
  approvalToEmployee: async (employeeEmail, title, requisitionId, approverName = '', comments = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/requisition/${requisitionId}`;
      
      const subject = '🎉 Your Purchase Requisition Has Been Approved!';
      const text = `Congratulations!\n\nYour purchase requisition has been approved and is being processed for procurement.\n\nTitle: ${title}\nRequisition ID: REQ-${requisitionId.toString().slice(-6).toUpperCase()}\n${approverName ? `Approved by: ${approverName}\n` : ''}${comments ? `Comments: ${comments}\n` : ''}\nTrack your requisition: ${trackingLink}\n\nThe procurement process will begin shortly.\n\nBest regards,\nProcurement Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h2 style="color: #155724; margin-top: 0;">🎉 Congratulations! Your Requisition is Approved</h2>
            <p style="color: #155724; line-height: 1.6; font-size: 16px;">
              Great news! Your purchase requisition has been fully approved and is now ready for procurement.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Approval Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Requisition ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requisitionId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${approverName ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Approved by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${approverName}</td>
                </tr>
                ` : ''}
                ${comments ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Comments:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-style: italic;">${comments}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ APPROVED</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h4 style="color: #856404; margin-top: 0;">📋 Next Steps:</h4>
              <ul style="color: #856404; margin: 0; padding-left: 20px;">
                <li>Your requisition is now with the procurement team</li>
                <li>The procurement process will begin based on your expected delivery date</li>
                <li>You will receive updates on procurement progress</li>
                <li>Final notification will be sent when items are delivered</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #007bff; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 Track Your Requisition
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #c3e6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Procurement Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in approvalToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of denial
   * @param {string} employeeEmail 
   * @param {string} reason 
   * @param {string} requisitionId 
   * @param {string} [deniedBy]
   * @returns {Promise<Object>}
   */
  denialToEmployee: async (employeeEmail, reason, requisitionId, deniedBy = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/requisition/${requisitionId}`;
      
      const subject = '📋 Purchase Requisition Status Update';
      const text = `Hello,\n\nWe regret to inform you that your purchase requisition has not been approved.\n\nRequisition ID: REQ-${requisitionId.toString().slice(-6).toUpperCase()}\nReason: ${reason}\n${deniedBy ? `Reviewed by: ${deniedBy}\n` : ''}\nView details: ${trackingLink}\n\nIf you have any questions, please contact your supervisor or the procurement team.\n\nBest regards,\nProcurement Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
            <h2 style="color: #721c24; margin-top: 0;">📋 Purchase Requisition Status Update</h2>
            <p style="color: #721c24; line-height: 1.6;">
              We regret to inform you that your purchase requisition has not been approved at this time.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">Requisition Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Requisition ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requisitionId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><span style="background-color: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">❌ NOT APPROVED</span></td>
                </tr>
                ${deniedBy ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Reviewed by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deniedBy}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Reason:</strong></td>
                  <td style="padding: 8px 0; font-style: italic; color: #721c24;">${reason}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <h4 style="color: #0c5460; margin-top: 0;">💡 What You Can Do:</h4>
              <ul style="color: #0c5460; margin: 0; padding-left: 20px;">
                <li>Review the reason for denial above</li>
                <li>Contact your supervisor for clarification</li>
                <li>Modify and resubmit your requisition if circumstances change</li>
                <li>Reach out to the procurement team if you have questions</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #6c757d; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 View Requisition Details
              </a>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${trackingLink}" style="color: #007bff; text-decoration: none;">${trackingLink}</a>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #f5c6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Procurement Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in denialToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify supply chain when procurement is complete
   * @param {Array|string} supplyChainEmails 
   * @param {string} employeeName 
   * @param {string} title
   * @param {string} requisitionId 
   * @param {number} finalCost
   * @returns {Promise<Object>}
   */
  procurementCompleteToSupplyChain: async (supplyChainEmails, employeeName, title, requisitionId, finalCost) => {
    try {
      const formattedCost = Number(finalCost).toFixed(2);
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/supply-chain/requisition/${requisitionId}`;
      
      const subject = '📦 Procurement Completed - Ready for Delivery';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h2 style="color: #155724; margin-top: 0;">📦 Procurement Completed Successfully</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Supply Chain Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              The procurement for the following requisition has been completed and items are ready for delivery.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Completed Procurement</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Final Cost:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #28a745; font-weight: bold;">XAF ${formattedCost}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Requisition ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requisitionId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #17a2b8; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">📦 READY FOR DELIVERY</span></td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #17a2b8; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px;">
                📋 Arrange Delivery
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #c3e6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Procurement Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: supplyChainEmails,
        subject,
        text: subject + '\n\n' + `Employee: ${employeeName}\nTitle: ${title}\nFinal Cost: XAF ${formattedCost}\nRequisition ID: REQ-${requisitionId.toString().slice(-6).toUpperCase()}\nTrack delivery: ${trackingLink}`,
        html
      });

    } catch (error) {
      console.error('❌ Error in procurementCompleteToSupplyChain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee when items are delivered
   * @param {string} employeeEmail 
   * @param {string} title
   * @param {string} requisitionId 
   * @param {string} deliveryLocation
   * @param {string} [deliveredBy]
   * @returns {Promise<Object>}
   */
  deliveryToEmployee: async (employeeEmail, title, requisitionId, deliveryLocation, deliveredBy = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/requisition/${requisitionId}`;
      
      const subject = '📦 Purchase Requisition Items Delivered!';
      const text = `Hello,\n\nGreat news! The items from your purchase requisition have been delivered.\n\nTitle: ${title}\nRequisition ID: REQ-${requisitionId.toString().slice(-6).toUpperCase()}\nDelivery Location: ${deliveryLocation}\n${deliveredBy ? `Delivered by: ${deliveredBy}\n` : ''}\nView details: ${trackingLink}\n\nPlease confirm receipt of all items and report any issues to the procurement team.\n\nBest regards,\nProcurement Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h2 style="color: #155724; margin-top: 0;">📦 Your Items Have Been Delivered!</h2>
            <p style="color: #155724; line-height: 1.6; font-size: 16px;">
              Excellent news! The items from your purchase requisition have been successfully delivered.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Delivery Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Requisition ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">REQ-${requisitionId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Delivery Location:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deliveryLocation}</td>
                </tr>
                ${deliveredBy ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Delivered by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deliveredBy}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ DELIVERED</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h4 style="color: #856404; margin-top: 0;">📋 Next Steps:</h4>
              <ul style="color: #856404; margin: 0; padding-left: 20px;">
                <li><strong>Check all delivered items</strong> against your original requisition</li>
                <li><strong>Report any missing or damaged items</strong> immediately</li>
                <li><strong>Contact procurement team</strong> if you have any concerns</li>
                <li><strong>Confirm receipt</strong> if everything is satisfactory</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #007bff; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 View Requisition Details
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #c3e6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Procurement Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in deliveryToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};


/**
 * Sick Leave Email Templates
 */
 const sendSickLeaveEmail = {
  /**
   * Notify supervisor of new sick leave request with approval link
   * @param {string} supervisorEmail 
   * @param {string} employeeName 
   * @param {string} leaveType
   * @param {string} leaveId 
   * @param {number} totalDays
   * @param {string} urgency
   * @param {string} reason
   * @returns {Promise<Object>} 
   */
  newLeaveToSupervisor: async (supervisorEmail, employeeName, leaveType, leaveId, totalDays, urgency, reason) => {
    try {
      if (!supervisorEmail || !employeeName || !leaveType || !leaveId) {
        throw new Error('Missing required parameters for supervisor email');
      }

      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const approvalLink = `${clientUrl}/supervisor/sick-leave/${leaveId}`;

      const urgencyColors = {
        'low': '#28a745',
        'medium': '#ffc107', 
        'high': '#fd7e14',
        'critical': '#dc3545'
      };

      const urgencyIcons = {
        'low': '📝',
        'medium': '⚠️',
        'high': '⚡',
        'critical': '🚨'
      };

      const subject = `${urgencyIcons[urgency] || '📋'} New Sick Leave Request Requires Your Approval - ${employeeName}`;
      
      const text = `Hello,\n\nYou have received a new sick leave request that requires your approval.\n\nEmployee: ${employeeName}\nLeave Type: ${leaveType}\nDuration: ${totalDays} day(s)\nUrgency: ${urgency.toUpperCase()}\nReason: ${reason.substring(0, 100)}...\n\nPlease click this link to review: ${approvalLink}\n\nBest regards,\nHR Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid ${urgencyColors[urgency] || '#ffc107'};">
            <h2 style="color: #333; margin-top: 0;">${urgencyIcons[urgency] || '📋'} Sick Leave Request - Approval Needed</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Supervisor,
            </p>
            <p style="color: #555; line-height: 1.6;">
              You have received a new sick leave request that requires your immediate attention and approval.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid ${urgencyColors[urgency] || '#ffc107'}; padding-bottom: 10px;">Leave Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Duration:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${totalDays} day${totalDays !== 1 ? 's' : ''}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Urgency Level:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="background-color: ${urgencyColors[urgency] || '#ffc107'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                      ${urgencyIcons[urgency] || '📋'} ${urgency}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">SL-${leaveId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; vertical-align: top;"><strong>Reason:</strong></td>
                  <td style="padding: 8px 0; font-style: italic; color: #666;">
                    ${reason.length > 150 ? reason.substring(0, 150) + '...' : reason}
                  </td>
                </tr>
              </table>
            </div>

            ${urgency === 'critical' ? `
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <h4 style="color: #721c24; margin-top: 0;">🚨 CRITICAL URGENCY NOTICE</h4>
              <p style="color: #721c24; margin: 0; font-weight: bold;">
                This is a critical sick leave request that requires immediate attention. Please review and process as soon as possible.
              </p>
            </div>
            ` : ''}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalLink}" 
                 style="display: inline-block; background-color: #28a745; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                📋 Review & Process Leave Request
              </a>
            </div>

            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${approvalLink}" style="color: #007bff; text-decoration: none;">${approvalLink}</a>
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the HR Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: supervisorEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in newLeaveToSupervisor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify HR team when supervisor approves
   * @param {Array|string} hrEmails 
   * @param {string} employeeName 
   * @param {string} leaveType
   * @param {string} leaveId 
   * @param {number} totalDays
   * @param {string} approvedBy
   * @returns {Promise<Object>} 
   */
  supervisorApprovalToHR: async (hrEmails, employeeName, leaveType, leaveId, totalDays, approvedBy) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/hr/sick-leave/${leaveId}`;

      const subject = '✅ Sick Leave Approved by Supervisor - HR Review Required';
      const text = `Hello HR Team,\n\nA sick leave request has been approved by the supervisor and requires your review.\n\nEmployee: ${employeeName}\nLeave Type: ${leaveType}\nDuration: ${totalDays} day(s)\nApproved by: ${approvedBy}\n\nPlease click this link to review: ${reviewLink}\n\nBest regards,\nHR Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8;">
            <h2 style="color: #333; margin-top: 0;">✅ Sick Leave Ready for HR Review</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear HR Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              A sick leave request has been <strong style="color: #28a745;">approved by the supervisor</strong> and is now ready for your final review and processing.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #17a2b8; padding-bottom: 10px;">Leave Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Duration:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${totalDays} day${totalDays !== 1 ? 's' : ''}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Approved by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${approvedBy}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">SL-${leaveId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ SUPERVISOR APPROVED</span></td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" 
                 style="display: inline-block; background-color: #17a2b8; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                📊 Review & Process Request
              </a>
            </div>

            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                <strong>Direct Link:</strong> <a href="${reviewLink}" style="color: #007bff; text-decoration: none;">${reviewLink}</a>
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the HR Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: hrEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in supervisorApprovalToHR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify HR team of new sick leave request
   * @param {Array|string} hrEmails 
   * @param {string} employeeName 
   * @param {string} leaveType
   * @param {string} leaveId 
   * @param {number} totalDays
   * @param {string} urgency
   * @param {boolean} medicalCertProvided
   * @returns {Promise<Object>} 
   */
  newLeaveToHR: async (hrEmails, employeeName, leaveType, leaveId, totalDays, urgency, medicalCertProvided) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/hr/sick-leave/${leaveId}`;

      const subject = `📋 New Sick Leave Request - ${employeeName}`;
      const text = `Hello HR Team,\n\nA new sick leave request has been submitted and is entering the approval process.\n\nEmployee: ${employeeName}\nLeave Type: ${leaveType}\nDuration: ${totalDays} day(s)\nUrgency: ${urgency}\nMedical Certificate: ${medicalCertProvided ? 'Provided' : 'Not Provided'}\n\nTrack request: ${trackingLink}\n\nBest regards,\nHR Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; border-left: 4px solid #52c41a;">
            <h2 style="color: #52c41a; margin-top: 0;">📋 New Sick Leave Request Submitted</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear HR Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              A new sick leave request has been submitted by ${employeeName} and is now in the approval process.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #52c41a; padding-bottom: 10px;">Leave Request Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Duration:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${totalDays} day${totalDays !== 1 ? 's' : ''}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Urgency:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-transform: uppercase;">${urgency}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Medical Certificate:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    ${medicalCertProvided ? 
                      '<span style="color: #28a745; font-weight: bold;">✅ Provided</span>' : 
                      '<span style="color: #dc3545; font-weight: bold;">❌ Not Provided</span>'
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING APPROVAL</span></td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #52c41a; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 Track Leave Request
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #c3e6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated notification from the HR Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: hrEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in newLeaveToHR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of successful submission
   * @param {string} employeeEmail 
   * @param {string} leaveType
   * @param {string} leaveId 
   * @param {number} totalDays
   * @param {string} [nextApprover]
   * @returns {Promise<Object>}
   */
  confirmationToEmployee: async (employeeEmail, leaveType, leaveId, totalDays, nextApprover = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/sick-leave/${leaveId}`;

      const subject = '✅ Sick Leave Request Submitted Successfully';
      const text = `Hello,\n\nYour sick leave request has been successfully submitted and is now under review.\n\nLeave Type: ${leaveType}\nDuration: ${totalDays} day(s)\nLeave ID: SL-${leaveId.toString().slice(-6).toUpperCase()}\n${nextApprover ? `Next Approver: ${nextApprover}\n` : ''}\nTrack your request: ${trackingLink}\n\nYou will receive email notifications as your request progresses through the approval process.\n\nBest regards,\nHR Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
            <h2 style="color: #1890ff; margin-top: 0;">✅ Sick Leave Request Submitted</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Employee,
            </p>
            <p style="color: #555; line-height: 1.6;">
              Your sick leave request has been successfully submitted and is now in the approval workflow.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #1890ff; padding-bottom: 10px;">Your Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Duration:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${totalDays} day${totalDays !== 1 ? 's' : ''}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">SL-${leaveId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                ${nextApprover ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Current Approver:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${nextApprover}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING APPROVAL</span></td>
                </tr>
              </table>
            </div>

            <div style="background-color: #f0f8ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #333;"><strong>Next Steps:</strong> Your request is now in the approval workflow. You will receive email notifications as it progresses through each approval stage.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #1890ff; color: white; 
                        padding: 12px 24px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 Track Your Request
              </a>
            </div>

            <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
              <p style="margin: 0;">Thank you for using our HR Management System!</p>
            </div>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in confirmationToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of approval
   * @param {string} employeeEmail 
   * @param {string} leaveType
   * @param {string} leaveId 
   * @param {string} [approverName]
   * @param {string} [comments]
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Object>}
   */
  approvalToEmployee: async (employeeEmail, leaveType, leaveId, approverName = '', comments = '', startDate, endDate) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/sick-leave/${leaveId}`;

      const subject = '🎉 Your Sick Leave Request Has Been Approved!';
      const text = `Congratulations!\n\nYour sick leave request has been approved.\n\nLeave Type: ${leaveType}\nLeave ID: SL-${leaveId.toString().slice(-6).toUpperCase()}\n${approverName ? `Approved by: ${approverName}\n` : ''}${comments ? `Comments: ${comments}\n` : ''}\nTrack your request: ${trackingLink}\n\nPlease ensure you follow company return-to-work procedures.\n\nBest regards,\nHR Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h2 style="color: #155724; margin-top: 0;">🎉 Congratulations! Your Sick Leave is Approved</h2>
            <p style="color: #155724; line-height: 1.6; font-size: 16px;">
              Great news! Your sick leave request has been approved and you are authorized to take the requested time off.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Approval Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">SL-${leaveId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Period:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">
                    ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}
                  </td>
                </tr>
                ${approverName ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Approved by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${approverName}</td>
                </tr>
                ` : ''}
                ${comments ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Comments:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-style: italic;">${comments}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ APPROVED</span></td>
                </tr>
              </table>
            </div>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h4 style="color: #856404; margin-top: 0;">📋 Important Reminders:</h4>
              <ul style="color: #856404; margin: 0; padding-left: 20px;">
                <li>Follow company return-to-work procedures</li>
                <li>Provide a return-to-work certificate if required</li>
                <li>Contact HR if you need to extend your leave</li>
                <li>Notify your supervisor of your actual return date</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #007bff; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 View Leave Details
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #c3e6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the HR Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in approvalToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of rejection
   * @param {string} employeeEmail 
   * @param {string} leaveType
   * @param {string} leaveId 
   * @param {string} reason 
   * @param {string} [rejectedBy]
   * @returns {Promise<Object>}
   */
  rejectionToEmployee: async (employeeEmail, leaveType, leaveId, reason, rejectedBy = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/sick-leave/${leaveId}`;

      const subject = '📋 Sick Leave Request Status Update';
      const text = `Hello,\n\nWe regret to inform you that your sick leave request has not been approved.\n\nLeave Type: ${leaveType}\nLeave ID: SL-${leaveId.toString().slice(-6).toUpperCase()}\nReason: ${reason}\n${rejectedBy ? `Reviewed by: ${rejectedBy}\n` : ''}\nView details: ${trackingLink}\n\nIf you have any questions, please contact HR or your supervisor.\n\nBest regards,\nHR Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
            <h2 style="color: #721c24; margin-top: 0;">📋 Sick Leave Request Status Update</h2>
            <p style="color: #721c24; line-height: 1.6;">
              We regret to inform you that your sick leave request has not been approved at this time.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">SL-${leaveId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><span style="background-color: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">❌ NOT APPROVED</span></td>
                </tr>
                ${rejectedBy ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Reviewed by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${rejectedBy}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Reason:</strong></td>
                  <td style="padding: 8px 0; font-style: italic; color: #721c24;">${reason}</td>
                </tr>
              </table>
            </div>

            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <h4 style="color: #0c5460; margin-top: 0;">💡 What You Can Do:</h4>
              <ul style="color: #0c5460; margin: 0; padding-left: 20px;">
                <li>Review the reason for rejection above</li>
                <li>Contact your supervisor or HR for clarification</li>
                <li>Provide additional documentation if needed</li>
                <li>Submit a revised request if circumstances change</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #6c757d; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 View Request Details
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #f5c6cb; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the HR Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in rejectionToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of approval progress
   * @param {string} employeeEmail 
   * @param {string} leaveType
   * @param {string} leaveId 
   * @param {string} statusMessage
   * @param {string} [approverName]
   * @returns {Promise<Object>}
   */
  approvalProgressToEmployee: async (employeeEmail, leaveType, leaveId, statusMessage, approverName = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/sick-leave/${leaveId}`;

      const subject = '📈 Sick Leave Request Progress Update';
      const text = `Hello,\n\nYour sick leave request has been updated.\n\nLeave Type: ${leaveType}\nLeave ID: SL-${leaveId.toString().slice(-6).toUpperCase()}\nStatus: ${statusMessage}\n${approverName ? `Updated by: ${approverName}\n` : ''}\nTrack your request: ${trackingLink}\n\nBest regards,\nHR Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
            <h2 style="color: #1890ff; margin-top: 0;">📈 Sick Leave Request Update</h2>
            <p style="color: #555; line-height: 1.6;">
              Your sick leave request has been updated and is progressing through the approval process.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #1890ff; padding-bottom: 10px;">Progress Update</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">SL-${leaveId.toString().slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Current Status:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-style: italic; color: #1890ff;">${statusMessage}</td>
                </tr>
                ${approverName ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>Updated by:</strong></td>
                  <td style="padding: 8px 0;">${approverName}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #1890ff; color: white; 
                        padding: 12px 24px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 Track Your Request
              </a>
            </div>

            <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
              <p style="margin: 0;">You will continue to receive updates as your request progresses.</p>
            </div>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in approvalProgressToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee about return to work requirements
   * @param {string} employeeEmail 
   * @param {string} leaveType
   * @param {string} leaveId 
   * @param {Date} expectedReturnDate
   * @param {boolean} certificateRequired
   * @returns {Promise<Object>}
   */
  returnToWorkReminder: async (employeeEmail, leaveType, leaveId, expectedReturnDate, certificateRequired) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/sick-leave/${leaveId}`;

      const subject = '🔄 Return to Work Reminder - Medical Clearance Required';
      const text = `Hello,\n\nThis is a reminder about your upcoming return to work.\n\nLeave Type: ${leaveType}\nExpected Return: ${new Date(expectedReturnDate).toLocaleDateString()}\n${certificateRequired ? 'IMPORTANT: A return-to-work medical certificate is required before you can resume duties.\n' : ''}\nView details: ${trackingLink}\n\nPlease contact HR if you need assistance.\n\nBest regards,\nHR Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #856404; margin-top: 0;">🔄 Return to Work Reminder</h2>
            <p style="color: #856404; line-height: 1.6;">
              This is a friendly reminder about your upcoming return to work following your approved sick leave.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">Return Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leave Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Expected Return Date:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #28a745;">
                    ${new Date(expectedReturnDate).toLocaleDateString()}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Medical Certificate:</strong></td>
                  <td style="padding: 8px 0;">
                    ${certificateRequired ? 
                      '<span style="color: #dc3545; font-weight: bold;">✅ REQUIRED</span>' : 
                      '<span style="color: #6c757d;">Not Required</span>'
                    }
                  </td>
                </tr>
              </table>
            </div>

            ${certificateRequired ? `
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <h4 style="color: #721c24; margin-top: 0;">📋 IMPORTANT: Medical Certificate Required</h4>
              <p style="color: #721c24; margin: 0;">
                You must provide a return-to-work medical certificate from your doctor before you can resume your duties. 
                Please ensure you obtain this certificate and submit it to HR before your return date.
              </p>
            </div>
            ` : ''}

            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <h4 style="color: #0c5460; margin-top: 0;">📝 Return to Work Checklist:</h4>
              <ul style="color: #0c5460; margin: 0; padding-left: 20px;">
                ${certificateRequired ? '<li><strong>Obtain return-to-work medical certificate</strong></li>' : ''}
                <li>Confirm your actual return date with your supervisor</li>
                <li>Contact HR if you need any workplace accommodations</li>
                <li>Review any work that accumulated during your absence</li>
                <li>Update your calendar and notify your team</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #17a2b8; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                📊 View Leave Details
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              If you have any questions or need assistance, please contact HR. We look forward to your return!
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in returnToWorkReminder:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};


/**
 * Incident Report Email Templates
 */
 const sendIncidentReportEmail = {
  /**
   * Notify supervisor of new incident report with review link
   * @param {string} supervisorEmail 
   * @param {string} employeeName 
   * @param {string} incidentType
   * @param {string} severity
   * @param {string} reportId 
   * @param {boolean} hasInjuries
   * @param {string} location
   * @returns {Promise<Object>} 
   */
  newIncidentToSupervisor: async (supervisorEmail, employeeName, incidentType, severity, reportId, hasInjuries = false, location = '') => {
    try {
      // Validate inputs
      if (!supervisorEmail || !employeeName || !incidentType || !reportId) {
        throw new Error('Missing required parameters for supervisor email');
      }

      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/supervisor/incident-reports/${reportId}`;

      const urgencyLevel = severity === 'critical' || severity === 'high' || hasInjuries ? 'URGENT' : 'IMPORTANT';
      const severityColor = {
        'critical': '#dc3545',
        'high': '#fd7e14', 
        'medium': '#ffc107',
        'low': '#28a745'
      }[severity] || '#ffc107';

      const subject = `${urgencyLevel}: Incident Report Review Required - ${employeeName}`;
      const text = `${urgencyLevel} - Incident Report Review Needed\n\nEmployee: ${employeeName}\nType: ${incidentType}\nSeverity: ${severity}\nInjuries: ${hasInjuries ? 'YES' : 'No'}\nLocation: ${location}\nReport ID: INC-${reportId.toString().slice(-6).toUpperCase()}\n\nPlease review immediately: ${reviewLink}\n\nBest regards,\nSafety Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${hasInjuries || severity === 'critical' ? '#f8d7da' : '#fff3cd'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${hasInjuries || severity === 'critical' ? '#dc3545' : '#ffc107'};">
            <h2 style="color: ${hasInjuries || severity === 'critical' ? '#721c24' : '#856404'}; margin-top: 0;">
              ${hasInjuries ? '🚨' : '⚠️'} ${urgencyLevel}: Incident Report Review Required
            </h2>
            <p style="color: #666; margin: 5px 0 0 0;">
              An incident has been reported and requires your immediate supervisory review.
            </p>
          </div>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Incident Type:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${incidentType.charAt(0).toUpperCase() + incidentType.slice(1).replace('_', ' ')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Severity Level:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <span style="color: ${severityColor}; font-weight: bold; text-transform: uppercase;">${severity}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Report ID:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">INC-${reportId.toString().slice(-6).toUpperCase()}</td>
              </tr>
              ${location ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Location:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${location}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Injuries Reported:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <span style="color: ${hasInjuries ? '#dc3545' : '#28a745'}; font-weight: bold;">
                    ${hasInjuries ? 'YES - INJURIES REPORTED' : 'No injuries reported'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;">
                  <span style="background-color: #ffc107; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    AWAITING YOUR REVIEW
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: ${hasInjuries ? '#f8d7da' : '#fff3cd'}; border-left: 4px solid ${hasInjuries ? '#dc3545' : '#ffc107'}; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: ${hasInjuries ? '#721c24' : '#856404'};">Supervisor Action Required</h4>
            <p style="margin: 0; color: ${hasInjuries ? '#721c24' : '#856404'};">
              This incident requires your immediate review and decision. Please log into the system to process this report promptly.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewLink}" 
               style="display: inline-block; background-color: ${hasInjuries || severity === 'critical' ? '#dc3545' : '#fd7e14'}; color: white; 
                      padding: 15px 30px; text-decoration: none; border-radius: 8px;
                      font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
              ${hasInjuries ? '🚨 URGENT: Review Incident' : '⚠️ Review Incident Report'}
            </a>
          </div>

          <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="color: #6c757d; margin: 0; font-size: 14px;">
              <strong>Direct Link:</strong> <a href="${reviewLink}" style="color: #007bff; text-decoration: none;">${reviewLink}</a>
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
            This is an automated message from the Safety Management System. Please do not reply to this email.
          </p>
        </div>
      `;

      return await sendEmail({
        to: supervisorEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in newIncidentToSupervisor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify HR team when supervisor approves/escalates
   * @param {Array|string} hrEmails 
   * @param {string} employeeName 
   * @param {string} incidentType
   * @param {string} severity
   * @param {string} reportId 
   * @param {string} supervisorName
   * @param {string} decision - 'approved', 'escalated'
   * @param {string} [comments]
   * @returns {Promise<Object>} 
   */
  supervisorDecisionToHR: async (hrEmails, employeeName, incidentType, severity, reportId, supervisorName, decision, comments = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/hr/incident-reports/${reportId}`;

      const isEscalated = decision === 'escalated';
      const subject = `Incident Report ${isEscalated ? 'Escalated' : 'Ready'} for HR Review - ${employeeName}`;
      const text = `Incident Report ${isEscalated ? 'Escalated' : 'Approved'} by Supervisor\n\nEmployee: ${employeeName}\nType: ${incidentType}\nSeverity: ${severity}\nSupervisor: ${supervisorName}\nDecision: ${decision}\nReport ID: INC-${reportId.toString().slice(-6).toUpperCase()}\n${comments ? `Comments: ${comments}\n` : ''}\nReview link: ${reviewLink}\n\nBest regards,\nSafety Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${isEscalated ? '#f8d7da' : '#d1ecf1'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${isEscalated ? '#dc3545' : '#17a2b8'};">
            <h2 style="color: #333; margin-top: 0;">
              📋 Incident Report ${isEscalated ? 'Escalated' : 'Ready'} for HR Review
            </h2>
            <p style="color: #555; line-height: 1.6;">
              Dear HR Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              An incident report has been ${isEscalated ? 'escalated' : 'approved'} by the supervisor and ${isEscalated ? 'requires immediate HR attention' : 'is ready for your review'}.
            </p>
          </div>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid ${isEscalated ? '#dc3545' : '#17a2b8'}; padding-bottom: 10px;">
              Incident Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Incident Type:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${incidentType.charAt(0).toUpperCase() + incidentType.slice(1).replace('_', ' ')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Severity:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <span style="color: ${severity === 'critical' ? '#dc3545' : severity === 'high' ? '#fd7e14' : severity === 'medium' ? '#ffc107' : '#28a745'}; font-weight: bold;">
                    ${severity.toUpperCase()}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Report ID:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">INC-${reportId.toString().slice(-6).toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Supervisor:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${supervisorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;">
                  <span style="background-color: ${isEscalated ? '#dc3545' : '#28a745'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${isEscalated ? '🚨 ESCALATED' : '✅ SUPERVISOR APPROVED'}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          ${comments ? `
          <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #495057;">Supervisor Comments</h4>
            <p style="margin: 0; color: #495057; font-style: italic;">${comments}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewLink}" 
               style="display: inline-block; background-color: ${isEscalated ? '#dc3545' : '#17a2b8'}; color: white; 
                      padding: 15px 30px; text-decoration: none; border-radius: 8px;
                      font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
              ${isEscalated ? '🚨 Review Escalated Incident' : '📊 Review & Process Report'}
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
            This is an automated message from the Safety Management System. Please do not reply to this email.
          </p>
        </div>
      `;

      return await sendEmail({
        to: hrEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in supervisorDecisionToHR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of report status update
   * @param {string} employeeEmail 
   * @param {string} reportNumber
   * @param {string} status
   * @param {string} reviewedBy
   * @param {string} [comments]
   * @returns {Promise<Object>}
   */
  statusUpdateToEmployee: async (employeeEmail, reportNumber, status, reviewedBy, comments = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/incident-reports`;

      const statusMap = {
        'approved': { text: 'Approved', color: '#28a745', icon: '✅' },
        'rejected': { text: 'Rejected', color: '#dc3545', icon: '❌' },
        'escalated': { text: 'Escalated for Investigation', color: '#fd7e14', icon: '🔍' },
        'resolved': { text: 'Resolved', color: '#28a745', icon: '✅' },
        'under_investigation': { text: 'Under Investigation', color: '#17a2b8', icon: '🔍' }
      };

      const statusInfo = statusMap[status] || { text: status, color: '#6c757d', icon: '📋' };

      const subject = `Incident Report Status Update - ${reportNumber}`;
      const text = `Incident Report Status Update\n\nYour incident report ${reportNumber} has been ${statusInfo.text.toLowerCase()}.\n\nReviewed by: ${reviewedBy}\n${comments ? `Comments: ${comments}\n` : ''}\nTrack your reports: ${trackingLink}\n\nBest regards,\nSafety Management Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${status === 'rejected' ? '#f8d7da' : '#e6f7ff'}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: ${status === 'rejected' ? '#721c24' : '#1890ff'}; margin: 0;">
              ${statusInfo.icon} Incident Report Status Update
            </h2>
            <p style="color: #666; margin: 5px 0 0 0;">Your incident report status has been updated.</p>
          </div>

          <div style="background-color: white; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0;">Report Status</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Report Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${reportNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>New Status:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                  <span style="color: ${statusInfo.color}; font-weight: bold;">${statusInfo.text}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Reviewed by:</strong></td>
                <td style="padding: 8px 0;">${reviewedBy}</td>
              </tr>
            </table>
          </div>

          ${comments ? `
          <div style="background-color: #f0f8ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #1890ff;">Comments</h4>
            <p style="margin: 0; color: #333;">${comments}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${trackingLink}" 
               style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Track Your Reports
            </a>
          </div>

          <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 0;">Thank you for reporting this incident and helping us maintain workplace safety.</p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in statusUpdateToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify about investigation assignment
   * @param {string} investigatorEmail 
   * @param {string} reportNumber
   * @param {string} employeeName
   * @param {string} incidentType
   * @param {string} severity
   * @param {string} assignedBy
   * @param {string} reportId
   * @returns {Promise<Object>}
   */
  investigationAssignment: async (investigatorEmail, reportNumber, employeeName, incidentType, severity, assignedBy, reportId) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const investigationLink = `${clientUrl}/hr/incident-reports/${reportId}`;

      const subject = `Investigation Assignment - ${reportNumber}`;
      const text = `Investigation Assignment\n\nYou have been assigned to investigate incident report ${reportNumber}.\n\nEmployee: ${employeeName}\nType: ${incidentType}\nSeverity: ${severity}\nAssigned by: ${assignedBy}\n\nAccess investigation: ${investigationLink}\n\nBest regards,\nHR Safety Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <h2 style="color: #856404; margin: 0;">🔍 Investigation Assignment</h2>
            <p style="color: #666; margin: 5px 0 0 0;">You have been assigned to investigate an incident report.</p>
          </div>

          <div style="background-color: white; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0;">Investigation Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Report Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${reportNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Employee:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Incident Type:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${incidentType.charAt(0).toUpperCase() + incidentType.slice(1).replace('_', ' ')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Severity:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                  <span style="color: ${severity === 'critical' ? '#dc3545' : severity === 'high' ? '#fd7e14' : '#ffc107'}; font-weight: bold;">
                    ${severity.toUpperCase()}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Assigned by:</strong></td>
                <td style="padding: 8px 0;">${assignedBy}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <h4 style="color: #0c5460; margin-top: 0;">Investigation Requirements:</h4>
            <ul style="color: #0c5460; margin: 0; padding-left: 20px;">
              <li>Review all incident details and evidence</li>
              <li>Interview involved parties and witnesses</li>
              <li>Document findings and recommendations</li>
              <li>Submit investigation report to HR</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${investigationLink}" 
               style="background-color: #17a2b8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              🔍 Begin Investigation
            </a>
          </div>

          <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 0;">Please begin this investigation promptly to ensure workplace safety.</p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: investigatorEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in investigationAssignment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

/**
 * Employee Suggestion Email Templates
 * Add these functions to your existing emailService.js file
 */

 const sendSuggestionEmail = {
  /**
   * Notify HR team of new suggestion submission
   * @param {Array|string} hrEmails - HR team email addresses
   * @param {string} employeeName - Name of employee (or "Anonymous")
   * @param {string} title - Suggestion title
   * @param {string} suggestionId - Suggestion ID for tracking
   * @param {string} category - Suggestion category
   * @param {string} priority - Priority level
   * @param {boolean} isAnonymous - Whether submission is anonymous
   * @returns {Promise<Object>}
   */
  newSuggestionToHR: async (hrEmails, employeeName, title, suggestionId, category, priority, isAnonymous = false) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/hr/suggestions/${suggestionId}`;

      const subject = `💡 New Employee Suggestion: ${title}`;
      const text = `Hello HR Team,\n\nA new employee suggestion has been submitted for review.\n\nEmployee: ${employeeName}\nTitle: ${title}\nCategory: ${category}\nPriority: ${priority}\nSuggestion ID: ${suggestionId}\n\nPlease review at: ${reviewLink}\n\nBest regards,\nSuggestion Management System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
            <h2 style="color: #333; margin-top: 0;">💡 New Employee Suggestion Submitted</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear HR Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              A new employee suggestion has been submitted and requires your review.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #1890ff; padding-bottom: 10px;">Suggestion Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Category:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${category.replace('_', ' ').toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Priority:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><span style="background-color: ${priority === 'high' ? '#fa8c16' : priority === 'medium' ? '#faad14' : '#52c41a'}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${priority.toUpperCase()}</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Suggestion ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${suggestionId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Submission Type:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: ${isAnonymous ? '#722ed1' : '#1890ff'}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${isAnonymous ? 'ANONYMOUS' : 'IDENTIFIED'}</span></td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" 
                 style="display: inline-block; background-color: #1890ff; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                📋 Review Suggestion
              </a>
            </div>

            <div style="background-color: #f0f8ff; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #1890ff; margin: 0; font-size: 14px;">
                <strong>Quick Actions Available:</strong> Approve, Request Modifications, Schedule Review, or Archive
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Employee Suggestion System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: hrEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in newSuggestionToHR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee that their suggestion was approved by HR
   * @param {string} employeeEmail - Employee's email
   * @param {string} title - Suggestion title
   * @param {string} suggestionId - Suggestion ID
   * @param {string} hrComments - HR reviewer comments
   * @param {number} feasibilityScore - Score from 1-10
   * @returns {Promise<Object>}
   */
  hrApprovalToEmployee: async (employeeEmail, title, suggestionId, hrComments, feasibilityScore) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/suggestions/${suggestionId}`;

      const subject = `🎉 Your Suggestion "${title}" Has Been Approved!`;
      const text = `Congratulations!\n\nYour employee suggestion has been approved by the HR team and is moving forward in the review process.\n\nTitle: ${title}\nSuggestion ID: ${suggestionId}\nFeasibility Score: ${feasibilityScore}/10\n\nHR Comments: ${hrComments}\n\nTrack progress: ${trackingLink}\n\nThank you for contributing to our workplace improvement!\n\nBest regards,\nHR Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; border-left: 4px solid #52c41a;">
            <h2 style="color: #389e0d; margin-top: 0;">🎉 Congratulations! Your Suggestion is Approved</h2>
            <p style="color: #389e0d; line-height: 1.6; font-size: 16px;">
              Your innovative suggestion has been reviewed and approved by our HR team!
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #52c41a; padding-bottom: 10px;">Approval Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Your Suggestion:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Suggestion ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${suggestionId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Feasibility Score:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="background-color: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${feasibilityScore}/10</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Current Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ HR APPROVED</span></td>
                </tr>
              </table>
            </div>

            ${hrComments ? `
            <div style="background-color: #e6f7ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <h4 style="color: #1890ff; margin-top: 0;">💬 HR Team Feedback:</h4>
              <p style="color: #333; margin-bottom: 0; font-style: italic;">"${hrComments}"</p>
            </div>
            ` : ''}

            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <h4 style="color: #856404; margin-top: 0;">📋 What Happens Next?</h4>
              <ul style="color: #856404; margin-bottom: 0; padding-left: 20px;">
                <li>Your suggestion moves to management review for implementation planning</li>
                <li>The community can continue to vote and comment on your idea</li>
                <li>You may be contacted for additional input during planning</li>
                <li>You'll receive updates as your suggestion progresses</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #52c41a; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px; margin-right: 10px;">
                📊 Track Your Suggestion
              </a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/employee/suggestions/new" 
                 style="display: inline-block; background-color: #1890ff; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                💡 Submit Another Idea
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #b7eb8f; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              Thank you for contributing to our continuous improvement! Your innovative thinking makes a difference.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in hrApprovalToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify management about HR-approved suggestions ready for implementation review
   * @param {Array|string} managementEmails - Management team email addresses
   * @param {string} employeeName - Employee name (or "Anonymous")
   * @param {string} title - Suggestion title
   * @param {string} suggestionId - Suggestion ID
   * @param {number} feasibilityScore - HR feasibility score
   * @param {number} communityVotes - Total upvotes from community
   * @param {string} category - Suggestion category
   * @returns {Promise<Object>}
   */
  hrApprovalToManagement: async (managementEmails, employeeName, title, suggestionId, feasibilityScore, communityVotes, category) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/admin/suggestions/${suggestionId}`;

      const subject = `HR Approved Suggestion Ready for Implementation Review: ${title}`;
      const text = `Hello Management Team,\n\nAn employee suggestion has been approved by HR and is ready for your implementation review.\n\nEmployee: ${employeeName}\nTitle: ${title}\nCategory: ${category}\nHR Feasibility Score: ${feasibilityScore}/10\nCommunity Support: ${communityVotes} upvotes\nSuggestion ID: ${suggestionId}\n\nPlease review for implementation: ${reviewLink}\n\nBest regards,\nHR Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h2 style="color: #333; margin-top: 0;">Management Review Required: HR-Approved Suggestion</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Management Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              An employee suggestion has been reviewed and approved by HR. It's now ready for your evaluation for potential implementation.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">Suggestion Overview</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Suggestion:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Category:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${category.replace('_', ' ').toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>HR Feasibility Score:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="background-color: ${feasibilityScore >= 8 ? '#52c41a' : feasibilityScore >= 6 ? '#faad14' : '#fa8c16'}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${feasibilityScore}/10</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Community Support:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="background-color: #1890ff; color: white; padding: 4px 8px; border-radius: 4px;">${communityVotes} upvotes</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">HR APPROVED - READY FOR IMPLEMENTATION REVIEW</span></td>
                </tr>
              </table>
            </div>

            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4 style="color: #1890ff; margin-top: 0;">Implementation Considerations:</h4>
              <ul style="color: #1890ff; margin-bottom: 0; padding-left: 20px;">
                <li>Review detailed implementation plan and resource requirements</li>
                <li>Assess budget implications and ROI potential</li>
                <li>Consider timeline and team assignment</li>
                <li>Evaluate alignment with strategic objectives</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" 
                 style="display: inline-block; background-color: #ffc107; color: #333; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px;">
                Review for Implementation
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the Employee Suggestion System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: managementEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('Error in hrApprovalToManagement:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee when their suggestion is approved for implementation
   * @param {string} employeeEmail - Employee's email
   * @param {string} title - Suggestion title
   * @param {string} suggestionId - Suggestion ID
   * @param {string} implementationTeam - Team assigned to implement
   * @param {number} [budget] - Budget allocated
   * @param {string} [comments] - Management comments
   * @returns {Promise<Object>}
   */
  implementationApprovalToEmployee: async (employeeEmail, title, suggestionId, implementationTeam, budget = null, comments = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/suggestions/${suggestionId}`;

      const subject = `Your Suggestion is Being Implemented: ${title}`;
      const text = `Congratulations!\n\nYour suggestion has been approved for implementation by management.\n\nTitle: ${title}\nSuggestion ID: ${suggestionId}\nImplementation Team: ${implementationTeam}\n${budget ? `Budget Allocated: XAF ${budget.toLocaleString()}\n` : ''}${comments ? `Comments: ${comments}\n` : ''}\nTrack progress: ${trackingLink}\n\nThank you for your innovative contribution!\n\nBest regards,\nManagement Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; border-left: 4px solid #52c41a;">
            <h2 style="color: #389e0d; margin-top: 0;">Your Idea is Coming to Life!</h2>
            <p style="color: #389e0d; line-height: 1.6; font-size: 16px;">
              Management has approved your suggestion for implementation. Your innovative thinking is making a real difference!
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #52c41a; padding-bottom: 10px;">Implementation Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Your Suggestion:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Implementation Team:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${implementationTeam}</td>
                </tr>
                ${budget ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Budget Allocated:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><span style="color: #52c41a; font-weight: bold;">XAF ${budget.toLocaleString()}</span></td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">APPROVED FOR IMPLEMENTATION</span></td>
                </tr>
              </table>
            </div>

            ${comments ? `
            <div style="background-color: #e6f7ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <h4 style="color: #1890ff; margin-top: 0;">Management Comments:</h4>
              <p style="color: #333; margin-bottom: 0; font-style: italic;">"${comments}"</p>
            </div>
            ` : ''}

            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <h4 style="color: #856404; margin-top: 0;">What's Next?</h4>
              <ul style="color: #856404; margin-bottom: 0; padding-left: 20px;">
                <li>The implementation team will begin detailed planning</li>
                <li>You may be contacted for additional input or clarification</li>
                <li>Regular progress updates will be shared</li>
                <li>You'll be recognized once implementation is complete</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background-color: #52c41a; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                Track Implementation Progress
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #b7eb8f; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              Your innovative thinking drives our continuous improvement. Thank you for making a difference!
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('Error in implementationApprovalToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee when their suggestion implementation is completed
   * @param {string} employeeEmail - Employee's email
   * @param {string} title - Suggestion title
   * @param {string} suggestionId - Suggestion ID
   * @param {string} [results] - Implementation results
   * @param {string} [impactMeasurement] - Measured impact
   * @returns {Promise<Object>}
   */
  implementationCompleteToEmployee: async (employeeEmail, title, suggestionId, results = '', impactMeasurement = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const suggestionLink = `${clientUrl}/employee/suggestions/${suggestionId}`;

      const subject = `Implementation Complete: Your Suggestion "${title}" is Now Live!`;
      const text = `Congratulations!\n\nYour suggestion has been successfully implemented and is now making a positive impact.\n\nTitle: ${title}\nSuggestion ID: ${suggestionId}\n${results ? `Results: ${results}\n` : ''}${impactMeasurement ? `Impact: ${impactMeasurement}\n` : ''}\nView details: ${suggestionLink}\n\nThank you for your valuable contribution to our continuous improvement!\n\nBest regards,\nImplementation Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; border-left: 4px solid #52c41a;">
            <h2 style="color: #389e0d; margin-top: 0;">Success! Your Idea is Now Reality</h2>
            <p style="color: #389e0d; line-height: 1.6; font-size: 16px;">
              Your suggestion has been successfully implemented and is now making a positive impact across our organization!
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #52c41a; padding-bottom: 10px;">Implementation Success</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Your Suggestion:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Completion Date:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${new Date().toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">SUCCESSFULLY IMPLEMENTED</span></td>
                </tr>
              </table>
            </div>

            ${results ? `
            <div style="background-color: #e6f7ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <h4 style="color: #1890ff; margin-top: 0;">Implementation Results:</h4>
              <p style="color: #333; margin-bottom: 0;">${results}</p>
            </div>
            ` : ''}

            ${impactMeasurement ? `
            <div style="background-color: #f0f8ff; border-left: 4px solid #722ed1; padding: 15px; margin: 20px 0;">
              <h4 style="color: #722ed1; margin-top: 0;">Measured Impact:</h4>
              <p style="color: #333; margin-bottom: 0; font-weight: 500;">${impactMeasurement}</p>
            </div>
            ` : ''}

            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <h4 style="color: #856404; margin-top: 0;">Recognition & Next Steps:</h4>
              <ul style="color: #856404; margin-bottom: 0; padding-left: 20px;">
                <li>Your contribution will be recognized in company communications</li>
                <li>This success story may be featured in internal newsletters</li>
                <li>Continue sharing your innovative ideas - they make a difference!</li>
                <li>Consider mentoring others in the suggestion process</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${suggestionLink}" 
                 style="display: inline-block; background-color: #52c41a; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px; margin-right: 10px;">
                View Success Story
              </a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/employee/suggestions/new" 
                 style="display: inline-block; background-color: #1890ff; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                Share Another Idea
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #b7eb8f; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              You are an innovation champion! Thank you for helping us create a better workplace for everyone.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('Error in implementationCompleteToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee when their suggestion receives community engagement
   * @param {string} employeeEmail - Employee's email
   * @param {string} title - Suggestion title
   * @param {string} suggestionId - Suggestion ID
   * @param {string} engagementType - Type of engagement (vote, comment, milestone)
   * @param {Object} engagementData - Additional engagement details
   * @returns {Promise<Object>}
   */
  communityEngagementToEmployee: async (employeeEmail, title, suggestionId, engagementType, engagementData) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const suggestionLink = `${clientUrl}/employee/suggestions/${suggestionId}`;

      let subject, content;

      switch (engagementType) {
        case 'milestone_votes':
          subject = `Your Suggestion "${title}" Reached ${engagementData.voteCount} Community Votes!`;
          content = `Your suggestion is gaining traction with ${engagementData.voteCount} community votes!`;
          break;
        case 'trending':
          subject = `Your Suggestion "${title}" is Now Trending!`;
          content = `Your suggestion is trending due to recent community engagement!`;
          break;
        case 'featured':
          subject = `Your Suggestion "${title}" Has Been Featured!`;
          content = `Your suggestion has been selected as a featured idea!`;
          break;
        default:
          subject = `Community Update: Your Suggestion "${title}"`;
          content = `Your suggestion has received new community engagement!`;
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #e6f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1890ff;">
            <h2 style="color: #1890ff; margin-top: 0;">Community Loves Your Idea!</h2>
            <p style="color: #1890ff; line-height: 1.6; font-size: 16px;">
              ${content}
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0;">${title}</h3>
              <p style="color: #666;">Suggestion ID: ${suggestionId}</p>
              
              ${engagementData.voteCount ? `<p style="color: #52c41a; font-weight: bold;">Total Community Votes: ${engagementData.voteCount}</p>` : ''}
              ${engagementData.commentCount ? `<p style="color: #1890ff; font-weight: bold;">Comments: ${engagementData.commentCount}</p>` : ''}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${suggestionLink}" 
                 style="display: inline-block; background-color: #1890ff; color: white; 
                        padding: 12px 25px; text-decoration: none; border-radius: 6px;
                        font-weight: bold; font-size: 14px;">
                View Community Feedback
              </a>
            </div>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text: `${content}\n\nSuggestion: ${title}\nID: ${suggestionId}\n\nView community feedback: ${suggestionLink}`,
        html
      });

    } catch (error) {
      console.error('Error in communityEngagementToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

/**
 * Vendor Management Email Templates
 */
 const sendVendorEmail = {
  /**
   * Welcome email for new vendor registration
   */
  vendorRegistrationConfirmation: async (vendorEmail, vendorName, vendorId) => {
    try {
      const subject = 'Welcome to Our Vendor Network - Registration Confirmed';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1890ff; margin: 0;">Welcome to Our Vendor Network!</h2>
            <p style="color: #666; margin: 5px 0 0 0;">Your vendor registration has been received and is under review.</p>
          </div>

          <div style="background-color: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px;">
            <h3 style="color: #333; margin-top: 0;">Registration Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Vendor Name:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${vendorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Vendor ID:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${vendorId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;"><span style="background-color: #faad14; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">UNDER REVIEW</span></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h4 style="color: #856404; margin-top: 0;">Next Steps:</h4>
            <ul style="color: #856404; margin: 0; padding-left: 20px;">
              <li>Our procurement team will review your registration</li>
              <li>You may be contacted for additional information</li>
              <li>You'll receive notification once your vendor status is updated</li>
              <li>Upon approval, you can participate in our procurement processes</li>
            </ul>
          </div>

          <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 0;">Thank you for your interest in partnering with us!</p>
            <p style="margin: 10px 0 0 0;">Best regards,<br>Procurement Team</p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: vendorEmail,
        subject,
        html
      });

    } catch (error) {
      console.error('Failed to send vendor registration confirmation:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Vendor status update notification
   */
  vendorStatusUpdate: async (vendorEmail, vendorName, newStatus, reason = '') => {
    try {
      const statusColors = {
        'active': '#52c41a',
        'suspended': '#ff4d4f',
        'inactive': '#d9d9d9',
        'under_review': '#faad14'
      };

      const subject = `Vendor Status Update - ${vendorName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: ${statusColors[newStatus] || '#1890ff'}; margin: 0;">Vendor Status Update</h2>
            <p style="color: #666; margin: 5px 0 0 0;">Your vendor status has been updated in our system.</p>
          </div>

          <div style="background-color: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px;">
            <h3 style="color: #333; margin-top: 0;">Status Update Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Vendor:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${vendorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>New Status:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                  <span style="background-color: ${statusColors[newStatus] || '#1890ff'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${newStatus.toUpperCase()}
                  </span>
                </td>
              </tr>
              ${reason ? `
              <tr>
                <td style="padding: 8px 0;"><strong>Reason:</strong></td>
                <td style="padding: 8px 0; font-style: italic;">${reason}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${newStatus === 'active' ? `
          <div style="background-color: #f6ffed; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #52c41a;">
            <p style="color: #52c41a; margin: 0; font-weight: bold;">
              Congratulations! You are now an active vendor and can participate in our procurement processes.
            </p>
          </div>
          ` : newStatus === 'suspended' ? `
          <div style="background-color: #fff2f0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ff4d4f;">
            <p style="color: #ff4d4f; margin: 0;">
              Your vendor account has been suspended. Please contact our procurement team for assistance.
            </p>
          </div>
          ` : ''}

          <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 0;">If you have any questions, please contact our procurement team.</p>
            <p style="margin: 10px 0 0 0;">Best regards,<br>Procurement Team</p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: vendorEmail,
        subject,
        html
      });

    } catch (error) {
      console.error('Failed to send vendor status update:', error);
      return { success: false, error: error.message };
    }
  }
};

const sendITSupportEmail = {
  /**
   * Notify supervisor of new IT support request with approval link
   * @param {string} supervisorEmail 
   * @param {string} employeeName 
   * @param {string} requestType - 'material_request' or 'technical_issue'
   * @param {string} title
   * @param {string} requestId 
   * @param {string} priority
   * @param {number} [estimatedCost] - For material requests
   * @param {string} urgency
   * @returns {Promise<Object>} 
   */
  newRequestToSupervisor: async (supervisorEmail, employeeName, requestType, title, requestId, priority, estimatedCost = null, urgency = 'normal') => {
    try {
      if (!supervisorEmail || !employeeName || !requestType || !title || !requestId) {
        throw new Error('Missing required parameters for supervisor email');
      }

      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const approvalLink = `${clientUrl}/supervisor/it-support/${requestId}`;

      const isUrgent = urgency === 'urgent' || priority === 'critical';
      const requestTypeLabel = requestType === 'material_request' ? 'Material Request' : 'Technical Issue';
      
      const subject = `${isUrgent ? '🚨 URGENT' : '📋'} IT ${requestTypeLabel} Approval Required - ${employeeName}`;
      const text = `${isUrgent ? 'URGENT - ' : ''}IT Support Request Approval Needed\n\nEmployee: ${employeeName}\nType: ${requestTypeLabel}\nTitle: ${title}\nPriority: ${priority.toUpperCase()}\nUrgency: ${urgency.toUpperCase()}\n${estimatedCost ? `Estimated Cost: XAF ${estimatedCost.toFixed(2)}\n` : ''}\nPlease review immediately: ${approvalLink}\n\nBest regards,\nIT Support System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${isUrgent ? '#fff2f0' : '#e6f7ff'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${isUrgent ? '#ff4d4f' : '#1890ff'};">
            <h2 style="color: ${isUrgent ? '#cf1322' : '#0050b3'}; margin-top: 0;">
              ${isUrgent ? '🚨 URGENT' : '📋'} IT Support Request - Approval Required
            </h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Supervisor,
            </p>
            <p style="color: #555; line-height: 1.6;">
              You have received a new IT support request that requires your ${isUrgent ? 'immediate' : ''} attention and approval.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid ${isUrgent ? '#ff4d4f' : '#1890ff'}; padding-bottom: 10px;">Request Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${requestTypeLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Priority Level:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="background-color: ${priority === 'critical' ? '#ff4d4f' : priority === 'high' ? '#fa8c16' : priority === 'medium' ? '#faad14' : '#52c41a'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                      ${priority}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Urgency:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="color: ${isUrgent ? '#cf1322' : '#666'}; font-weight: ${isUrgent ? 'bold' : 'normal'}; text-transform: uppercase;">
                      ${urgency}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Ticket Number:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${requestId}</td>
                </tr>
                ${estimatedCost ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Estimated Cost:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #fa8c16; font-weight: bold;">XAF ${estimatedCost.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;">
                    <span style="background-color: #faad14; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                      AWAITING YOUR APPROVAL
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            ${isUrgent ? `
            <div style="background-color: #fff2f0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ff4d4f;">
              <h4 style="color: #cf1322; margin-top: 0;">🚨 URGENT ATTENTION REQUIRED</h4>
              <p style="color: #cf1322; margin: 0; font-weight: bold;">
                This ${requestTypeLabel.toLowerCase()} requires immediate attention. Please review and process as soon as possible.
              </p>
            </div>
            ` : ''}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalLink}" 
                 style="display: inline-block; background-color: ${isUrgent ? '#ff4d4f' : '#1890ff'}; color: white; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                ${isUrgent ? '🚨 URGENT: Review Request' : '📋 Review & Process Request'}
              </a>
            </div>

            <div style="background-color: #f6ffed; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="color: #389e0d; margin: 0; font-size: 14px;">
                <strong>Quick Actions Available:</strong> Approve, Request More Info, Escalate, or Reject
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the IT Support Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: supervisorEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in newRequestToSupervisor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify IT department when supervisor approves
   * @param {Array|string} itEmails 
   * @param {string} employeeName 
   * @param {string} requestType
   * @param {string} title
   * @param {string} requestId 
   * @param {string} supervisorName
   * @param {number} [estimatedCost]
   * @param {string} [comments]
   * @returns {Promise<Object>} 
   */
  supervisorApprovalToIT: async (itEmails, employeeName, requestType, title, requestId, supervisorName, estimatedCost = null, comments = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/it/support-requests/${requestId}`;

      const requestTypeLabel = requestType === 'material_request' ? 'Material Request' : 'Technical Issue';
      const subject = `IT ${requestTypeLabel} Approved by Supervisor - Ready for IT Review`;
      const text = `IT Support Request Approved by Supervisor\n\nEmployee: ${employeeName}\nType: ${requestTypeLabel}\nTitle: ${title}\nSupervisor: ${supervisorName}\n${estimatedCost ? `Estimated Cost: XAF ${estimatedCost.toFixed(2)}\n` : ''}${comments ? `Comments: ${comments}\n` : ''}\nReview link: ${reviewLink}\n\nBest regards,\nIT Support System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; border-left: 4px solid #52c41a;">
            <h2 style="color: #333; margin-top: 0;">✅ IT Support Request Ready for IT Review</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear IT Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              An IT support request has been <strong style="color: #52c41a;">approved by the supervisor</strong> and is now ready for your technical review and processing.
            </p>
          </div>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #52c41a; padding-bottom: 10px;">Approved Request Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request Type:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${requestTypeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Title:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Approved by:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${supervisorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Ticket Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${requestId}</td>
              </tr>
              ${estimatedCost ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Estimated Cost:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #fa8c16; font-weight: bold;">XAF ${estimatedCost.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;"><span style="background-color: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ SUPERVISOR APPROVED</span></td>
              </tr>
            </table>
          </div>

          ${comments ? `
          <div style="background-color: #e6f7ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
            <h4 style="color: #1890ff; margin-top: 0;">Supervisor Comments:</h4>
            <p style="color: #333; margin-bottom: 0; font-style: italic;">"${comments}"</p>
          </div>
          ` : ''}

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #faad14;">
            <h4 style="color: #ad6800; margin-top: 0;">IT Review Actions:</h4>
            <ul style="color: #ad6800; margin-bottom: 0; padding-left: 20px;">
              <li>Assess technical requirements and feasibility</li>
              <li>Assign appropriate IT staff member</li>
              <li>Estimate completion time and resources needed</li>
              <li>Provide cost validation for material requests</li>
              <li>Begin implementation or procurement process</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewLink}" 
               style="display: inline-block; background-color: #52c41a; color: white; 
                      padding: 15px 30px; text-decoration: none; border-radius: 8px;
                      font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
              🔧 Review & Assign IT Request
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
            This is an automated message from the IT Support Management System. Please do not reply to this email.
          </p>
        </div>
      `;

      return await sendEmail({
        to: itEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in supervisorApprovalToIT:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify finance team for high-cost material requests
   * @param {Array|string} financeEmails 
   * @param {string} employeeName 
   * @param {string} title
   * @param {string} requestId 
   * @param {number} estimatedCost
   * @param {string} itRecommendation
   * @returns {Promise<Object>}
   */
  itApprovalToFinance: async (financeEmails, employeeName, title, requestId, estimatedCost, itRecommendation) => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const reviewLink = `${clientUrl}/finance/it-support/${requestId}`;

      const subject = `High-Cost IT Material Request - Finance Approval Required`;
      const text = `High-Cost IT Material Request - Finance Approval Needed\n\nEmployee: ${employeeName}\nTitle: ${title}\nEstimated Cost: XAF ${estimatedCost.toFixed(2)}\nIT Recommendation: ${itRecommendation}\nTicket: ${requestId}\n\nReview link: ${reviewLink}\n\nBest regards,\nIT Support System`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #faad14;">
            <h2 style="color: #333; margin-top: 0;">💰 High-Cost IT Request - Finance Approval Required</h2>
            <p style="color: #555; line-height: 1.6;">
              Dear Finance Team,
            </p>
            <p style="color: #555; line-height: 1.6;">
              A high-cost IT material request has been approved by both supervisor and IT department. Your budget approval is required to proceed.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #faad14; padding-bottom: 10px;">Budget Approval Request</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Request Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Estimated Cost:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #fa8c16; font-weight: bold; font-size: 16px;">XAF ${estimatedCost.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>IT Recommendation:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${itRecommendation}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #faad14; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING FINANCE APPROVAL</span></td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" 
                 style="display: inline-block; background-color: #faad14; color: #333; 
                        padding: 15px 30px; text-decoration: none; border-radius: 8px;
                        font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                💼 Review Budget Request
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; margin-bottom: 0; text-align: center;">
              This is an automated message from the IT Support Management System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: financeEmails,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in itApprovalToFinance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee of request status updates
   * @param {string} employeeEmail 
   * @param {string} ticketNumber
   * @param {string} status
   * @param {string} updateMessage
   * @param {string} [updatedBy]
   * @param {string} [nextSteps]
   * @returns {Promise<Object>}
   */
  statusUpdateToEmployee: async (employeeEmail, ticketNumber, status, updateMessage, updatedBy = '', nextSteps = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${clientUrl}/employee/it-support`;

      const statusMap = {
        'approved': { text: 'Approved', color: '#52c41a', icon: '✅' },
        'rejected': { text: 'Not Approved', color: '#ff4d4f', icon: '❌' },
        'in_progress': { text: 'Work in Progress', color: '#1890ff', icon: '🔧' },
        'resolved': { text: 'Resolved', color: '#52c41a', icon: '✅' },
        'pending_finance': { text: 'Pending Finance Approval', color: '#faad14', icon: '💰' },
        'it_assigned': { text: 'Assigned to IT Team', color: '#722ed1', icon: '👨‍💻' }
      };

      const statusInfo = statusMap[status] || { text: status, color: '#666', icon: '📋' };

      const subject = `IT Support Update - ${ticketNumber}`;
      const text = `IT Support Request Status Update\n\nYour IT support request ${ticketNumber} has been updated.\n\nNew Status: ${statusInfo.text}\nUpdate: ${updateMessage}\n${updatedBy ? `Updated by: ${updatedBy}\n` : ''}${nextSteps ? `Next Steps: ${nextSteps}\n` : ''}\nTrack your request: ${trackingLink}\n\nBest regards,\nIT Support Team`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${status === 'rejected' ? '#fff2f0' : '#e6f7ff'}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: ${statusInfo.color}; margin: 0;">
              ${statusInfo.icon} IT Support Request Update
            </h2>
            <p style="color: #666; margin: 5px 0 0 0;">Your IT support request status has been updated.</p>
          </div>

          <div style="background-color: white; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0;">Request Status</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Ticket Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${ticketNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>New Status:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                  <span style="color: ${statusInfo.color}; font-weight: bold;">${statusInfo.text}</span>
                </td>
              </tr>
              ${updatedBy ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><strong>Updated by:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${updatedBy}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0;"><strong>Update:</strong></td>
                <td style="padding: 8px 0;">${updateMessage}</td>
              </tr>
            </table>
          </div>

          ${nextSteps ? `
          <div style="background-color: #f0f8ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #1890ff;">Next Steps:</h4>
            <p style="margin: 0; color: #333;">${nextSteps}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${trackingLink}" 
               style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Track Your Requests
            </a>
          </div>

          <div style="border-top: 1px solid #e8e8e8; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 0;">Thank you for using our IT Support System!</p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text,
        html
      });

    } catch (error) {
      console.error('❌ Error in statusUpdateToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Notify employee when their request is resolved
   * @param {string} employeeEmail 
   * @param {string} ticketNumber
   * @param {string} requestType
   * @param {string} resolutionDetails
   * @param {string} resolvedBy
   * @param {string} [deliveryInfo] - For material requests
   * @returns {Promise<Object>}
   */
  resolutionToEmployee: async (employeeEmail, ticketNumber, requestType, resolutionDetails, resolvedBy, deliveryInfo = '') => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const feedbackLink = `${clientUrl}/employee/it-support/feedback/${ticketNumber}`;

      const isMaterialRequest = requestType === 'material_request';
      const subject = `${isMaterialRequest ? '📦' : '🔧'} Your IT ${isMaterialRequest ? 'Material Request' : 'Issue'} Has Been Resolved!`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f6ffed; padding: 20px; border-radius: 8px; border-left: 4px solid #52c41a;">
            <h2 style="color: #389e0d; margin-top: 0;">
              ${isMaterialRequest ? '📦' : '🔧'} Your IT Request Has Been Resolved!
            </h2>
            <p style="color: #389e0d; line-height: 1.6; font-size: 16px;">
              Great news! Your IT ${isMaterialRequest ? 'material request' : 'support issue'} has been successfully resolved.
            </p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #333; margin-top: 0; border-bottom: 2px solid #52c41a; padding-bottom: 10px;">Resolution Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Ticket Number:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${ticketNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Resolved by:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${resolvedBy}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Resolution Date:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${new Date().toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✅ RESOLVED</span></td>
                </tr>
              </table>
            </div>

            <div style="background-color: #e6f7ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0;">
              <h4 style="color: #1890ff; margin-top: 0;">Resolution Summary:</h4>
              <p style="color: #333; margin-bottom: 0;">${resolutionDetails}</p>
            </div>

            ${deliveryInfo ? `
            <div style="background-color: #fff3cd; border-left: 4px solid #faad14; padding: 15px; margin: 20px 0;">
              <h4 style="color: #ad6800; margin-top: 0;">Delivery Information:</h4>
              <p style="color: #333; margin-bottom: 0;">${deliveryInfo}</p>
            </div>
            ` : ''}

            <div style="background-color: #f0f8ff; border-left: 4px solid #722ed1; padding: 15px; margin: 20px 0;">
              <h4 style="color: #722ed1; margin-top: 0;">Your Feedback Matters:</h4>
              <p style="color: #333; margin-bottom: 10px;">Please take a moment to rate your experience and help us improve our IT support services.</p>
              <div style="text-align: center;">
                <a href="${feedbackLink}" 
                   style="display: inline-block; background-color: #722ed1; color: white; 
                          padding: 10px 20px; text-decoration: none; border-radius: 6px;
                          font-weight: bold; font-size: 14px;">
                  📝 Provide Feedback
                </a>
              </div>
            </div>

            <hr style="border: none; border-top: 1px solid #b7eb8f; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0; text-align: center;">
              Thank you for using our IT Support System! If you experience any further issues, please don't hesitate to submit a new request.
            </p>
          </div>
        </div>
      `;

      return await sendEmail({
        to: employeeEmail,
        subject,
        text: `Your IT ${isMaterialRequest ? 'material request' : 'support issue'} has been resolved.\n\nTicket: ${ticketNumber}\nResolved by: ${resolvedBy}\nResolution: ${resolutionDetails}\n\nPlease provide feedback: ${feedbackLink}`,
        html
      });

    } catch (error) {
      console.error('❌ Error in resolutionToEmployee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = {
  sendEmail,
  sendCashRequestEmail,
  sendPurchaseRequisitionEmail,
  sendSickLeaveEmail,
  sendITSupportEmail,
  sendIncidentReportEmail,
  sendVendorEmail,
  sendSuggestionEmail,
  getTransporter
};