// require('dotenv').config();
// const mongoose = require('mongoose');
// const User = require('../models/User');
// const bcrypt = require('bcryptjs');

// async function createAdmin() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
    
//     const adminData = {
//       email: 'admin@grato.com',
//       password: await bcrypt.hash('secureAdminPassword123', 10),
//       fullName: 'System Administrator',
//       userType: 'admin',
//       isActive: true,
//       emailVerified: true
//     };

//     const existingAdmin = await User.findOne({ email: adminData.email });
//     if (existingAdmin) {
//       console.log('Admin user already exists');
//       return;
//     }

//     const admin = new User(adminData);
//     await admin.save();
//     console.log('Admin user created successfully:', admin.email);

//   } catch (error) {
//     console.error('Error creating admin:', error);
//   } finally {
//     mongoose.disconnect();
//   }
// }

// createAdmin();



// require('dotenv').config();
// const mongoose = require('mongoose');
// const User = require('../models/User');

// async function createEmployeeUsers() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
    
//     const employeeUsers = [
//       {
//         email: 'marcel.ulevus@gmail.com',
//         password: 'employee1234', 
//         fullName: 'Marcel Test',
//         role: 'employee',
//         department: 'IT',
//         isActive: true,
//         emailVerified: true
//       }
//     ];

//     console.log('Creating employee users...');
    
//     // First, delete existing users to avoid conflicts
//     for (const userData of employeeUsers) {
//       await User.deleteOne({ email: userData.email });
//       console.log(`Deleted existing user: ${userData.email}`);
//     }
    
//     // Create new users (let the pre('save') middleware handle password hashing)
//     for (const userData of employeeUsers) {
//       const user = new User(userData); // Don't manually hash - let the model do it
//       await user.save();
//       console.log(`User ${userData.email} created successfully`);
//       console.log(`Password hash: ${user.password.substring(0, 20)}...`);
//     }

//     console.log('\nEmployee users created:');
//     console.log('------------------------');
//     console.log('1. Email: employee1@grato.com');
//     console.log('   Password: employee123');
//     console.log('   Status: Active & Verified (Sales)');
//     console.log('\n2. Email: employee2@grato.com');
//     console.log('   Password: employee123');
//     console.log('   Status: Active but Unverified (Marketing)');
//     console.log('\n3. Email: inactive.employee@grato.com');
//     console.log('   Password: employee123');
//     console.log('   Status: Inactive (HR)');
//     console.log('------------------------');
//     console.log('\nUsers recreated with proper password hashing!');

//   } catch (error) {
//     console.error('Error creating employee users:', error);
//   } finally {
//     await mongoose.disconnect();
//     process.exit(0);
//   }
// }

// createEmployeeUsers();





require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdminUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const adminUsers = [
      {
        email: 'qiroketeam@gmail.com',
        password: 'admin1234', 
        fullName: 'System Administrator',
        role: 'finance',
        department: 'Finance',
        isActive: true,
        emailVerified: true
      }
    ];

    console.log('Creating admin users...');
    
    // First, delete existing admin users to avoid duplicates
    for (const userData of adminUsers) {
      await User.deleteOne({ email: userData.email });
      console.log(`Cleared existing user: ${userData.email}`);
    }
    
    // Create new admin users
    for (const userData of adminUsers) {
      const user = new User(userData);
      await user.save(); // Password will be hashed by the pre-save middleware
      console.log(`Admin user ${userData.email} created successfully`);
    }

    console.log('\nAdmin users created:');
    console.log('---------------------');
    console.log('1. Primary Admin:');
    console.log('   Email: marcel.ngong@gratoglobal.com');
    console.log('   Password: admin1234');
    console.log('   Department: IT');
    console.log('---------------------');
    console.log('\nNote: Passwords were automatically hashed by the User model');

  } catch (error) {
    console.error('Error creating admin users:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdminUsers();





// require('dotenv').config();
// const mongoose = require('mongoose');
// const User = require('../models/User');

// async function createSupervisorUsers() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
    
//     const supervisorUsers = [
//       {
//         email: 'marcelngong50@gmail.com',
//         password: 'supervisor123', 
//         fullName: 'Mike Johnson',
//         role: 'supervisor',
//         department: 'Sales',
//         isActive: true,
//         emailVerified: true,
//         permissions: ['approve_requests', 'view_reports']
//       },
//       {
//         email: 'marketing.supervisor@grato.com',
//         password: 'supervisor123',
//         fullName: 'Sarah Williams',
//         role: 'supervisor',
//         department: 'Marketing',
//         isActive: true,
//         emailVerified: true,
//         permissions: ['approve_requests', 'view_reports']
//       },
//       {
//         email: 'hr.supervisor@grato.com',
//         password: 'supervisor123',
//         fullName: 'Robert Brown',
//         role: 'supervisor',
//         department: 'HR',
//         isActive: true,
//         emailVerified: false,
//         permissions: ['approve_requests']
//       }
//     ];

//     console.log('⏳ Creating supervisor users...\n');
    
//     // Clear existing test supervisors first
//     for (const userData of supervisorUsers) {
//       await User.deleteMany({ 
//         email: userData.email,
//         role: 'supervisor' 
//       });
//       console.log(`♻️  Cleared existing supervisor: ${userData.email}`);
//     }
    
//     // Create new supervisors
//     const createdUsers = [];
//     for (const userData of supervisorUsers) {
//       const user = new User(userData);
//       await user.save(); // Password hashing happens automatically via pre-save hook
//       createdUsers.push(user);
//       console.log(`✅ Created supervisor: ${user.email}`);
//     }

//     console.log('\n🏆 Supervisor Users Created:');
//     console.log('========================================');
    
//     createdUsers.forEach((user, index) => {
//       console.log(`\n👤 SUPERVISOR #${index + 1}:`);
//       console.log(`   Name: ${user.fullName}`);
//       console.log(`   Email: ${user.email}`);
//       console.log(`   Password: supervisor123`);
//       console.log(`   Department: ${user.department}`);
//       console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`);
//       console.log(`   Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
//       console.log(`   Permissions: ${user.permissions.join(', ')}`);
//     });
    
//     console.log('\n========================================');
//     console.log('💡 Note: Passwords are automatically hashed during save');
//     console.log('========================================');

//   } catch (error) {
//     console.error('\n❌ Error creating supervisor users:', error.message);
//     console.error('Stack:', error.stack);
//   } finally {
//     await mongoose.disconnect();
//     process.exit(0);
//   }
// }

// createSupervisorUsers();








// require('dotenv').config();
// const mongoose = require('mongoose');
// const User = require('../models/User');

// async function createFinanceUsers() {
//   try {
//     // Connect to MongoDB with enhanced options
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//       connectTimeoutMS: 5000,
//       socketTimeoutMS: 30000
//     });

//     console.log('🔌 Connected to MongoDB\n');

//     const financeUsers = [
//       {
//         email: 'finance1@grato.com',
//         password: 'finance123', // Will be hashed automatically
//         fullName: 'David Wilson',
//         role: 'finance',
//         department: 'Finance',
//         isActive: true,
//         emailVerified: true,
//         permissions: ['approve_payments', 'view_financial_reports', 'process_reimbursements']
//       },
//       {
//         email: 'finance2@grato.com',
//         password: 'finance123',
//         fullName: 'Lisa Taylor',
//         role: 'finance',
//         department: 'Accounting',
//         isActive: true,
//         emailVerified: true,
//         permissions: ['approve_payments', 'view_financial_reports']
//       },
//       {
//         email: 'finance.trainee@grato.com',
//         password: 'finance123',
//         fullName: 'Trainee Accountant',
//         role: 'finance',
//         department: 'Finance',
//         isActive: true,
//         emailVerified: false,
//         permissions: ['view_financial_reports'],
//         training: true
//       }
//     ];

//     console.log('💰 Preparing to create finance users...\n');

//     // Clean up existing test users first
//     const deleteResults = await User.deleteMany({
//       email: { $in: financeUsers.map(u => u.email) },
//       role: 'finance'
//     });
//     console.log(`♻️  Cleared ${deleteResults.deletedCount} existing finance users`);

//     // Create new finance users
//     const createdUsers = [];
//     for (const userData of financeUsers) {
//       try {
//         const user = new User(userData);
//         await user.save(); // Password hashing happens automatically
//         createdUsers.push(user);
//         console.log(`✅ Created finance user: ${user.email}`);
//       } catch (saveError) {
//         console.error(`⚠️  Failed to create ${userData.email}:`, saveError.message);
//       }
//     }

//     // Display results
//     console.log('\n📊 Finance User Creation Summary:');
//     console.log('===========================================');
//     console.log(`📌 Total Attempted: ${financeUsers.length}`);
//     console.log(`✅ Successful: ${createdUsers.length}`);
//     console.log(`❌ Failed: ${financeUsers.length - createdUsers.length}`);
//     console.log('===========================================\n');

//     console.log('👔 Finance Users Created:');
//     console.log('===========================================');
    
//     createdUsers.forEach((user, index) => {
//       console.log(`\n#${index + 1} ${user.fullName}`);
//       console.log(`📧 Email: ${user.email}`);
//       console.log(`🔑 Password: ${financeUsers[index].password} (plaintext for testing)`);
//       console.log(`🏢 Department: ${user.department}`);
//       console.log(`🛡️ Permissions: ${user.permissions?.join(', ') || 'None'}`);
//       console.log(`📅 Created: ${user.createdAt.toLocaleString()}`);
//       console.log(`🔍 Status: ${user.isActive ? 'Active' : 'Inactive'} | Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
//       if (user.training) console.log('🎓 Training Account');
//     });

//     console.log('\n===========================================');
//     console.log('💡 Note: Passwords are automatically hashed during save');
//     console.log('===========================================');

//   } catch (error) {
//     console.error('\n🔥 Critical Error:', error.message);
//     console.error('Stack Trace:', error.stack);
//   } finally {
//     try {
//       await mongoose.disconnect();
//       console.log('\n🔌 Disconnected from MongoDB');
//     } catch (disconnectError) {
//       console.error('\n⚠️ Failed to disconnect:', disconnectError.message);
//     }
//     process.exit(0);
//   }
// }

// // Execute with enhanced error handling
// createFinanceUsers().catch(err => {
//   console.error('🚨 Unhandled rejection:', err);
//   process.exit(1);
// });




//create with terminal
// node scripts/createAdmin.js