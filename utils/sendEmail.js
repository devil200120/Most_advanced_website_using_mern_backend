const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter with better error handling
const createTransporter = () => {
  return nodemailer.createTransport({  // ✅ Fixed: createTransport (not createTransporter)
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false // For development only
    }
  });
};

// Send email function with better error handling
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    // Verify connection first
    await transporter.verify();
    logger.info('Email transporter verified successfully');
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    logger.error(`Failed to send email to ${options.to}:`, error);
    
    // Don't throw error - just log it and continue
    return {
      success: false,
      error: error.message
    };
  }
};

// Send bulk emails
const sendBulkEmail = async (recipients, subject, text, html) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendEmail({
        to: recipient,
        subject,
        text,
        html
      });
      results.push({ recipient, success: true, messageId: result.messageId });
    } catch (error) {
      results.push({ recipient, success: false, error: error.message });
    }
  }
  
  return results;
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration test passed');
    return true;
  } catch (error) {
    logger.error('Email configuration test failed:', error);
    return false;
  }
};

// Send verification email with template
const sendVerificationEmail = async (email, firstName, verificationToken) => {
  try {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 15px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .button:hover { background-color: #0056b3; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .url-text { word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Exam Management System!</h1>
          </div>
          <div class="content">
            <h2>Hello ${firstName},</h2>
            <p>Thank you for registering with our Exam Management System. To complete your registration, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this URL into your browser:</p>
            <div class="url-text">${verificationUrl}</div>
            
            <p><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
            
            <p>If you didn't create an account with us, please ignore this email.</p>
            
            <p>Best regards,<br>
            Exam Management Team</p>
          </div>
          <div class="footer">
            <p>This email was sent automatically. Please do not reply to this email.</p>
            <p>&copy; 2025 Exam Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: email,
      subject: 'Email Verification - Exam Management System',
      html: emailContent
    });

    return result;
  } catch (error) {
    logger.error(`Failed to send verification email to ${email}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>You requested a password reset for your Exam Management System account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>If the button doesn't work, copy and paste this URL: ${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: email,
      subject: 'Password Reset - Exam Management System',
      html: emailContent
    });

    return result;
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  testEmailConfig,
  sendVerificationEmail,
  sendPasswordResetEmail
};