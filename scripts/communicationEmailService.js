const nodemailer = require('nodemailer');

// Reuse existing transporter from emailService.js
let _transporter = null;
const getTransporter = () => {
  if (!_transporter) {
    const config = {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5
    };
    _transporter = nodemailer.createTransport(config);
  }
  return _transporter;
};

/**
 * Send communication email with tracking
 */
const sendCommunicationEmail = async (options, communicationId, retries = 3) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  
  // Generate tracking pixel for email opens
  const trackingPixel = `<img src="${clientUrl}/api/communications/${communicationId}/track-open?user=${options.userId}" width="1" height="1" style="display:none;" />`;
  
  // Add tracking to links
  const contentWithTracking = options.html ? 
    options.html.replace(
      /<a\s+href="([^"]+)"/gi, 
      `<a href="${clientUrl}/api/communications/${communicationId}/track-click?url=$1&user=${options.userId}" target="_blank"`
    ) : '';
  
  const mailOptions = {
    from: options.from || process.env.SMTP_FROM || `"Company Communications" <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    html: contentWithTracking + trackingPixel,
    text: options.text,
    attachments: options.attachments,
    headers: {
      'X-Communication-ID': communicationId,
      'X-Priority': options.priority === 'urgent' ? '1' : options.priority === 'important' ? '2' : '3'
    }
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await getTransporter().sendMail(mailOptions);
      return { 
        success: true, 
        messageId: info.messageId,
        accepted: info.accepted,
        response: info.response 
      };
    } catch (error) {
      console.error(`❌ Email attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        return { 
          success: false, 
          error: error.message,
          code: error.code
        };
      }
      
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Generate professional email HTML template
 */
const generateCommunicationTemplate = (communication, recipient) => {
  const priorityStyles = {
    urgent: { bg: '#fff1f0', border: '#ff4d4f', icon: '🚨', badge: 'URGENT' },
    important: { bg: '#fff7e6', border: '#fa8c16', icon: '⚠️', badge: 'IMPORTANT' },
    normal: { bg: '#f0f8ff', border: '#1890ff', icon: 'ℹ️', badge: 'INFO' }
  };
  
  const typeIcons = {
    announcement: '📢',
    policy: '📋',
    emergency: '🚨',
    newsletter: '📰',
    general: 'ℹ️',
    training: '🎓',
    event: '📅'
  };
  
  const style = priorityStyles[communication.priority] || priorityStyles.normal;
  const icon = typeIcons[communication.messageType] || '📧';
  
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const viewLink = `${clientUrl}/communications/${communication._id}/view`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${communication.title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                    ${icon} Company Communications
                  </h1>
                </td>
              </tr>
              
              <!-- Priority Badge -->
              ${communication.priority !== 'normal' ? `
              <tr>
                <td style="padding: 15px 30px; background-color: ${style.bg}; border-left: 4px solid ${style.border};">
                  <div style="display: inline-block; background-color: ${style.border}; color: white; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 12px;">
                    ${style.icon} ${style.badge}
                  </div>
                </td>
              </tr>
              ` : ''}
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 30px 30px 20px 30px;">
                  <h2 style="color: #333; margin: 0 0 10px 0; font-size: 24px;">
                    ${communication.title}
                  </h2>
                  <p style="color: #666; margin: 0; font-size: 14px;">
                    Hello ${recipient.fullName},
                  </p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 0 30px 30px 30px;">
                  <div style="color: #555; line-height: 1.8; font-size: 15px;">
                    ${communication.content}
                  </div>
                </td>
              </tr>
              
              <!-- Attachments -->
              ${communication.attachments && communication.attachments.length > 0 ? `
              <tr>
                <td style="padding: 0 30px 30px 30px;">
                  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee;">
                    <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">
                      📎 Attachments (${communication.attachments.length})
                    </h3>
                    ${communication.attachments.map(att => `
                      <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
                        <a href="${clientUrl}/api/communications/${communication._id}/attachment/${att._id}" 
                           style="color: #1890ff; text-decoration: none; font-size: 14px;">
                          📄 ${att.originalName || att.filename}
                        </a>
                        <span style="color: #999; font-size: 12px; margin-left: 10px;">
                          (${(att.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    `).join('')}
                  </div>
                </td>
              </tr>
              ` : ''}
              
              <!-- Action Button -->
              <tr>
                <td style="padding: 0 30px 30px 30px; text-align: center;">
                  <a href="${viewLink}" 
                     style="display: inline-block; background-color: #1890ff; color: white; 
                            padding: 14px 32px; text-decoration: none; border-radius: 8px;
                            font-weight: bold; font-size: 16px;">
                    View Full Message
                  </a>
                </td>
              </tr>
              
              <!-- Metadata -->
              <tr>
                <td style="padding: 20px 30px; background-color: #f9f9f9; border-top: 1px solid #eee;">
                  <table width="100%" cellpadding="5" cellspacing="0">
                    <tr>
                      <td style="color: #666; font-size: 12px;">
                        <strong>From:</strong> ${communication.sender?.fullName || 'Company Communications'}
                      </td>
                      <td style="color: #666; font-size: 12px; text-align: right;">
                        <strong>Sent:</strong> ${new Date(communication.sentAt || Date.now()).toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td style="color: #666; font-size: 12px;">
                        <strong>Type:</strong> ${communication.messageType}
                      </td>
                      <td style="color: #666; font-size: 12px; text-align: right;">
                        <strong>ID:</strong> COM-${communication._id.toString().slice(-6).toUpperCase()}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; background-color: #f0f0f0; text-align: center;">
                  <p style="color: #888; font-size: 12px; margin: 0 0 10px 0;">
                    This is an official company communication. Please do not reply to this email.
                  </p>
                  <p style="color: #999; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} Your Company Name. All rights reserved.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Generate plain text version
 */
const generatePlainText = (communication, recipient) => {
  const stripHtml = (html) => {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  };
  
  const typeLabels = {
    announcement: 'ANNOUNCEMENT',
    policy: 'POLICY UPDATE',
    emergency: 'EMERGENCY ALERT',
    newsletter: 'NEWSLETTER',
    general: 'GENERAL MESSAGE',
    training: 'TRAINING',
    event: 'EVENT'
  };
  
  let text = `
====================================================
${typeLabels[communication.messageType] || 'COMPANY COMMUNICATION'}
====================================================

${communication.title}

Hello ${recipient.fullName},

${stripHtml(communication.content)}

`;

  if (communication.attachments && communication.attachments.length > 0) {
    text += `\n\nATTACHMENTS (${communication.attachments.length}):\n`;
    communication.attachments.forEach(att => {
      text += `- ${att.originalName || att.filename}\n`;
    });
  }

  text += `
----------------------------------------------------
From: ${communication.sender?.fullName || 'Company Communications'}
Sent: ${new Date(communication.sentAt || Date.now()).toLocaleString()}
Type: ${communication.messageType}
ID: COM-${communication._id.toString().slice(-6).toUpperCase()}
----------------------------------------------------

This is an official company communication.
© ${new Date().getFullYear()} Your Company Name. All rights reserved.
`;

  return text;
};

/**
 * Batch send emails with rate limiting
 */
const batchSendEmails = async (communication, recipients, batchSize = 50) => {
  const results = {
    sent: 0,
    failed: 0,
    errors: []
  };
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    const promises = batch.map(async (recipient) => {
      try {
        const html = generateCommunicationTemplate(communication, recipient);
        const text = generatePlainText(communication, recipient);
        
        const result = await sendCommunicationEmail({
          to: recipient.email,
          subject: `[${communication.priority === 'urgent' ? '🚨 URGENT' : communication.priority === 'important' ? '⚠️ IMPORTANT' : ''}] ${communication.title}`,
          html,
          text,
          userId: recipient._id,
          priority: communication.priority,
          attachments: communication.attachments?.map(att => ({
            filename: att.originalName || att.filename,
            path: att.path
          }))
        }, communication._id);
        
        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            recipient: recipient.email,
            error: result.error
          });
        }
        
        return result;
      } catch (error) {
        results.failed++;
        results.errors.push({
          recipient: recipient.email,
          error: error.message
        });
        return { success: false, error: error.message };
      }
    });
    
    await Promise.allSettled(promises);
    
    // Rate limiting delay between batches
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
};

module.exports = {
  sendCommunicationEmail,
  generateCommunicationTemplate,
  generatePlainText,
  batchSendEmails
};