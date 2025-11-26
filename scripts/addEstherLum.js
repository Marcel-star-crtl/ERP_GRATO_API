require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas\n');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

async function fixEstherPassword() {
  try {
    console.log('🔧 FIXING ESTHER LUM PASSWORD');
    console.log('='.repeat(80) + '\n');

    await connectDB();

    // Find Esther
    const esther = await User.findOne({ email: 'esther.lum@gratoglobal.com' });
    
    if (!esther) {
      console.error('❌ User not found: esther.lum@gratoglobal.com');
      process.exit(1);
    }

    console.log('✅ Found user:', esther.fullName);
    console.log('   Current position:', esther.position);
    console.log('   Current role:', esther.role);
    console.log('   Is active:', esther.isActive);
    console.log('');

    // The password to set
    const newPassword = 'Lum_HR_5823@';

    // Test the current password first
    console.log('🔍 Testing current password...');
    const currentPasswordWorks = await esther.comparePassword(newPassword);
    
    if (currentPasswordWorks) {
      console.log('✅ Current password already works! No update needed.');
      console.log('');
      await testLogin(esther.email, newPassword);
      process.exit(0);
    }

    console.log('⚠️  Current password does not match. Updating...\n');

    // Update the password - Let the pre-save hook hash it
    esther.password = newPassword;
    
    // Also fix the position field
    esther.position = 'HR Assistant';
    
    // Save (this triggers the pre-save hook which hashes the password)
    await esther.save();

    console.log('✅ Password updated successfully!');
    console.log('✅ Position updated to: HR Assistant');
    console.log('');

    // Verify the password works now
    console.log('🔍 Verifying new password...');
    const updatedUser = await User.findOne({ email: 'esther.lum@gratoglobal.com' });
    const passwordWorks = await updatedUser.comparePassword(newPassword);

    if (passwordWorks) {
      console.log('✅ Password verification successful!\n');
      
      console.log('📊 UPDATED USER DETAILS');
      console.log('='.repeat(80));
      console.log(`Email              : ${updatedUser.email}`);
      console.log(`Full Name          : ${updatedUser.fullName}`);
      console.log(`Position           : ${updatedUser.position}`);
      console.log(`Department         : ${updatedUser.department}`);
      console.log(`Role               : ${updatedUser.role}`);
      console.log(`Is Active          : ${updatedUser.isActive}`);
      console.log(`Hierarchy Level    : ${updatedUser.hierarchyLevel}`);
      console.log('='.repeat(80) + '\n');

      console.log('🔐 LOGIN CREDENTIALS');
      console.log('='.repeat(80));
      console.log(`Email              : esther.lum@gratoglobal.com`);
      console.log(`Password           : ${newPassword}`);
      console.log('='.repeat(80) + '\n');

      console.log('✅ PASSWORD FIX COMPLETE!');
      console.log('');
      console.log('You can now login with these credentials.\n');

      // Test actual bcrypt comparison
      await testLogin(updatedUser.email, newPassword);

    } else {
      console.error('❌ Password verification failed!');
      console.error('Something went wrong with the password update.');
      process.exit(1);
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

async function testLogin(email, password) {
  console.log('🧪 TESTING LOGIN SIMULATION');
  console.log('='.repeat(80));
  
  try {
    // Simulate the login process
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    if (!user.isActive) {
      console.log('❌ User is not active');
      return;
    }

    const isValidPassword = await user.comparePassword(password);
    
    if (isValidPassword) {
      console.log('✅ LOGIN TEST PASSED!');
      console.log('   Email:', email);
      console.log('   Password comparison: SUCCESS');
      console.log('   User is active: YES');
    } else {
      console.log('❌ LOGIN TEST FAILED - Password comparison returned false');
      
      // Debug info
      console.log('\n🔍 DEBUG INFO:');
      console.log('   Stored hash:', user.password);
      console.log('   Password length:', password.length);
      console.log('   Password:', password);
      
      // Test manual bcrypt comparison
      const manualTest = await bcrypt.compare(password, user.password);
      console.log('   Manual bcrypt.compare:', manualTest);
    }
    
  } catch (error) {
    console.error('❌ Login test error:', error.message);
  }
  
  console.log('='.repeat(80) + '\n');
}

// Alternative: Set password directly with pre-hashed value
async function setPasswordDirectly() {
  try {
    console.log('🔧 SETTING PASSWORD DIRECTLY (ALTERNATIVE METHOD)');
    console.log('='.repeat(80) + '\n');

    await connectDB();

    const esther = await User.findOne({ email: 'esther.lum@gratoglobal.com' });
    
    if (!esther) {
      console.error('❌ User not found');
      process.exit(1);
    }

    const newPassword = 'Lum_HR_5823@';
    
    // Hash the password manually
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    console.log('Password to set:', newPassword);
    console.log('Hashed password:', hashedPassword);
    console.log('');

    // Update directly without triggering pre-save hook
    await User.updateOne(
      { email: 'esther.lum@gratoglobal.com' },
      { 
        $set: { 
          password: hashedPassword,
          position: 'HR Assistant'
        } 
      }
    );

    console.log('✅ Password set directly in database');
    console.log('');

    // Verify
    const updated = await User.findOne({ email: 'esther.lum@gratoglobal.com' });
    const works = await bcrypt.compare(newPassword, updated.password);
    
    console.log('Verification:', works ? '✅ SUCCESS' : '❌ FAILED');
    
    if (works) {
      console.log('\n🔐 LOGIN CREDENTIALS');
      console.log('='.repeat(80));
      console.log(`Email              : esther.lum@gratoglobal.com`);
      console.log(`Password           : ${newPassword}`);
      console.log('='.repeat(80) + '\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (require.main === module) {
  if (command === '--direct' || command === '-d') {
    setPasswordDirectly();
  } else {
    fixEstherPassword();
  }
}

module.exports = { fixEstherPassword };