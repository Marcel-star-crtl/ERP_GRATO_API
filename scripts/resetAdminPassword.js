require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const newPassword = "secureAdminPassword123";
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await User.updateOne(
      { email: "admin@grato.com" },
      { $set: { password: hashedPassword } }
    );
    
    if (result.modifiedCount === 1) {
      console.log('Admin password reset successfully');
    } else {
      console.log('Admin user not found');
    }
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    mongoose.disconnect();
  }
}

resetPassword();