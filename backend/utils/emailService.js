const nodemailer = require('nodemailer');

// Create transporter based on environment
const createTransporter = () => {
  // For production with Gmail
  if (process.env.EMAIL_HOST === 'smtp.gmail.com') {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  
  // For development with Ethereal (fake SMTP for testing)
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'your-test-account@ethereal.email', // Replace with actual
        pass: 'your-test-password' // Replace with actual
      }
    });
  }
  
  // Default SMTP configuration
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const transporter = createTransporter();

// Verify email configuration on startup
const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service configured successfully');
  } catch (error) {
    console.error('❌ Email service configuration failed:', error.message);
  }
};

// Call verification
verifyEmailConfig();

// Send application status update email
const sendStatusEmail = async (to, candidateName, jobTitle, status) => {
  const statusColors = {
    applied: '#3b82f6',
    shortlisted: '#10b981',
    rejected: '#ef4444',
    hired: '#059669',
    interviewing: '#8b5cf6'
  };
  
  const statusMessages = {
    applied: 'Your application has been received',
    shortlisted: 'Congratulations! You have been shortlisted',
    rejected: 'We regret to inform you',
    hired: 'Congratulations! You have been selected',
    interviewing: 'You have been invited for an interview'
  };
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Application Status Update</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Inter', Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background-color: #f4f4f5;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 40px 30px;
        }
        .status-badge {
          display: inline-block;
          background-color: ${statusColors[status]};
          color: white;
          padding: 8px 20px;
          border-radius: 50px;
          font-weight: 600;
          margin: 20px 0;
          text-transform: uppercase;
          font-size: 14px;
        }
        .message {
          margin: 20px 0;
          color: #374151;
        }
        .cta-button {
          display: inline-block;
          background-color: ${statusColors[status]};
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: 600;
        }
        .footer {
          background-color: #f9fafb;
          padding: 20px;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
        .divider {
          height: 1px;
          background-color: #e5e7eb;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 JobBoard</h1>
          <p>Application Status Update</p>
        </div>
        
        <div class="content">
          <h2>Hello ${candidateName},</h2>
          
          <p class="message">
            Your application for <strong>${jobTitle}</strong> has been updated.
          </p>
          
          <div style="text-align: center;">
            <div class="status-badge">
              ${status.toUpperCase()}
            </div>
          </div>
          
          <p class="message">
            <strong>${statusMessages[status]}</strong>
          </p>
          
          ${status === 'shortlisted' ? `
            <p>A member of our recruitment team will contact you shortly with next steps.</p>
          ` : status === 'interviewing' ? `
            <p>Please check your dashboard for interview scheduling details.</p>
          ` : status === 'rejected' ? `
            <p>Thank you for your interest. We encourage you to apply for other positions that match your profile.</p>
          ` : ''}
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">
              View Dashboard
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated message from JobBoard.</p>
          <p>If you didn't expect this update, please ignore this email.</p>
          <div class="divider"></div>
          <p>&copy; ${new Date().getFullYear()} JobBoard. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Hello ${candidateName},
    
    Your application for ${jobTitle} has been updated to: ${status.toUpperCase()}
    
    ${statusMessages[status]}
    
    View your dashboard for more details: ${process.env.FRONTEND_URL}/dashboard
    
    Best regards,
    JobBoard Team
  `;
  
  try {
    const info = await transporter.sendMail({
      from: `"JobBoard" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: `Application Status Update - ${jobTitle}`,
      html,
      text
    });
    
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email to new user
const sendWelcomeEmail = async (to, name, role) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Welcome to JobBoard</title>
    </head>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h2>Welcome to JobBoard, ${name}! 🎉</h2>
        <p>Thank you for joining as a <strong>${role}</strong>.</p>
        
        ${role === 'candidate' ? `
          <h3>Next steps:</h3>
          <ul>
            <li>Complete your profile</li>
            <li>Upload your resume</li>
            <li>Browse and apply for jobs</li>
          </ul>
        ` : `
          <h3>Next steps:</h3>
          <ul>
            <li>Complete your company profile</li>
            <li>Post your first job</li>
            <li>Review applications</li>
          </ul>
        `}
        
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
          Go to Dashboard
        </a>
        
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Best regards,<br/>JobBoard Team</p>
      </div>
    </body>
    </html>
  `;
  
  try {
    await transporter.sendMail({
      from: `"JobBoard" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Welcome to JobBoard!',
      html
    });
    return { success: true };
  } catch (error) {
    console.error('Welcome email failed:', error);
    return { success: false };
  }
};

// Send password reset email
const sendPasswordResetEmail = async (to, name, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
          Reset Password
        </a>
        
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Best regards,<br/>JobBoard Team</p>
      </div>
    </body>
    </html>
  `;
  
  try {
    await transporter.sendMail({
      from: `"JobBoard" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Password Reset Request',
      html
    });
    return { success: true };
  } catch (error) {
    console.error('Password reset email failed:', error);
    return { success: false };
  }
};

// Send job alert email to candidates
const sendJobAlert = async (to, name, jobs) => {
  const jobsHtml = jobs.map(job => `
    <div style="border: 1px solid #e5e7eb; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0;">${job.title}</h3>
      <p style="margin: 5px 0;">📍 ${job.location} | 💰 $${job.salary.toLocaleString()}/year</p>
      <p style="margin: 5px 0;">🏢 ${job.employer?.name || 'Company'}</p>
      <a href="${process.env.FRONTEND_URL}/jobs/${job._id}" style="color: #4F46E5; text-decoration: none;">View Details →</a>
    </div>
  `).join('');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>New Job Matches for You</title>
    </head>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h2>New Jobs Matching Your Profile</h2>
        <p>Hello ${name},</p>
        <p>We found ${jobs.length} new job(s) that match your skills and preferences:</p>
        
        ${jobsHtml}
        
        <a href="${process.env.FRONTEND_URL}/jobs" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
          Browse All Jobs
        </a>
        
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">You're receiving this because you opted in for job alerts.</p>
      </div>
    </body>
    </html>
  `;
  
  try {
    await transporter.sendMail({
      from: `"JobBoard" <${process.env.EMAIL_USER}>`,
      to,
      subject: `🔥 ${jobs.length} New Job Match${jobs.length > 1 ? 'es' : ''} For You`,
      html
    });
    return { success: true };
  } catch (error) {
    console.error('Job alert email failed:', error);
    return { success: false };
  }
};

// Send application confirmation to candidate
const sendApplicationConfirmation = async (to, name, jobTitle, companyName) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Application Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h2>Application Received ✓</h2>
        <p>Hello ${name},</p>
        <p>Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been successfully submitted.</p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>What's next?</strong></p>
          <p style="margin: 5px 0 0;">The employer will review your application and update you on the status.</p>
        </div>
        
        <a href="${process.env.FRONTEND_URL}/dashboard/candidate/applications" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
          Track Application
        </a>
        
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Best regards,<br/>JobBoard Team</p>
      </div>
    </body>
    </html>
  `;
  
  try {
    await transporter.sendMail({
      from: `"JobBoard" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Application Confirmed: ${jobTitle}`,
      html
    });
    return { success: true };
  } catch (error) {
    console.error('Application confirmation email failed:', error);
    return { success: false };
  }
};

// Send new application notification to employer
const sendNewApplicationNotification = async (to, employerName, candidateName, jobTitle) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>New Application Received</title>
    </head>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h2>New Application Received! 🎉</h2>
        <p>Hello ${employerName},</p>
        <p><strong>${candidateName}</strong> has applied for <strong>${jobTitle}</strong>.</p>
        
        <a href="${process.env.FRONTEND_URL}/dashboard/employer/applications" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
          Review Application
        </a>
        
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Best regards,<br/>JobBoard Team</p>
      </div>
    </body>
    </html>
  `;
  
  try {
    await transporter.sendMail({
      from: `"JobBoard" <${process.env.EMAIL_USER}>`,
      to,
      subject: `New Applicant: ${jobTitle}`,
      html
    });
    return { success: true };
  } catch (error) {
    console.error('New application notification failed:', error);
    return { success: false };
  }
};

module.exports = {
  sendStatusEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendJobAlert,
  sendApplicationConfirmation,
  sendNewApplicationNotification,
  verifyEmailConfig
};