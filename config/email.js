// File: c:\Users\KIIT0001\Desktop\exam_site\backend\config\email.js
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Email templates
const emailTemplates = {
  verification: (name, verificationUrl) => ({
    subject: 'Email Verification - Exam Management System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Exam Management System!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for registering with us. Please click the button below to verify your email address:</p>
            <a href="${verificationUrl}" class="button">Verify Email</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p>${verificationUrl}</p>
            <p>This link will expire in 24 hours for security purposes.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>Exam Management Team</p>
            <p>&copy; 2025 Exam Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  passwordReset: (name, resetUrl) => ({
    subject: 'Password Reset - Exam Management System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>You have requested to reset your password. Please click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p>${resetUrl}</p>
            <div class="warning">
              <strong>Security Notice:</strong> This link will expire in 1 hour for security purposes.
            </div>
            <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>Exam Management Team</p>
            <p>&copy; 2025 Exam Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  examReminder: (name, examTitle, examDate) => ({
    subject: `Exam Reminder: ${examTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exam Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .exam-info { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📚 Exam Reminder</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>This is a friendly reminder about your upcoming exam:</p>
            <div class="exam-info">
              <h3>${examTitle}</h3>
              <p><strong>Date & Time:</strong> ${examDate}</p>
            </div>
            <p>Please make sure you are prepared and have a stable internet connection.</p>
            <p>Good luck with your exam!</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>Exam Management Team</p>
            <p>&copy; 2025 Exam Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  resultPublished: (name, examTitle, score, grade) => ({
    subject: `Exam Results: ${examTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exam Results</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #17a2b8; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .result-card { background-color: white; padding: 20px; border-radius: 5px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .score { font-size: 24px; font-weight: bold; color: #007bff; }
          .grade { font-size: 20px; font-weight: bold; color: #28a745; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Exam Results Published</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Your exam results for <strong>${examTitle}</strong> have been published:</p>
            <div class="result-card">
              <h3>Your Performance</h3>
              <p>Score: <span class="score">${score}%</span></p>
              <p>Grade: <span class="grade">${grade}</span></p>
            </div>
            <p>Congratulations on completing your exam! You can view detailed results by logging into your account.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>Exam Management Team</p>
            <p>&copy; 2025 Exam Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Create transporter based on environment
const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  };

  // For development, you might want to use a different configuration
  if (process.env.NODE_ENV === 'development') {
    // Optional: Use ethereal for testing
    // config.host = 'smtp.ethereal.email';
    // config.port = 587;
    // config.auth = { user: 'ethereal_user', pass: 'ethereal_pass' };
  }

  return nodemailer.createTransporter(config);
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration is valid');
    return true;
  } catch (error) {
    logger.error('Email configuration error:', error);
    return false;
  }
};

module.exports = {
  createTransporter,
  emailTemplates,
  testEmailConfig
};