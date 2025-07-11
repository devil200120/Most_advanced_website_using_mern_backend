const nodemailer = require('nodemailer');
require('dotenv').config();

const testEmail = async () => {
  console.log('Testing Gmail SMTP connection...');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'subhankardash45585@gmail.com',
      pass: 'qewtohaatclfppje'
    }
  });

  try {
    // Test connection
    await transporter.verify();
    console.log('✅ Gmail SMTP connection successful!');
    
    // Send test email
    const info = await transporter.sendMail({
      from: 'subhankardash45585@gmail.com',
      to: 'subhankardash45585@gmail.com',
      subject: 'Simple Email Test',
      text: 'This is a simple test email from your exam management system.',
      html: '<h2>✅ Email Test Successful!</h2><p>Your Gmail SMTP is working correctly.</p>'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Check your email inbox!');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('Full error:', error);
  }
};

testEmail();