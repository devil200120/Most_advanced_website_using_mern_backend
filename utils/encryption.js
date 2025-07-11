// File: c:\Users\KIIT0001\Desktop\exam_site\backend\utils\encryption.js
const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const secretKey = process.env.ENCRYPTION_SECRET || 'your-32-character-secret-key-here!!';
const key = crypto.scryptSync(secretKey, 'salt', 32);

// Encrypt text
const encrypt = (text) => {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    throw new Error('Encryption failed');
  }
};

// Decrypt text
const decrypt = (encryptedData) => {
  try {
    const { encrypted, iv, authTag } = encryptedData;
    const decipher = crypto.createDecipher(algorithm, key, Buffer.from(iv, 'hex'));
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed');
  }
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate OTP
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  
  return otp;
};

module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  comparePassword,
  generateToken,
  generateOTP
};