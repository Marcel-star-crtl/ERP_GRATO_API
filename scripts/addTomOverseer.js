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

async function addJulesTechnician() {
  try {
    console.log('🔧 ADDING JULES MOUNA - FIELD TECHNICIAN');
    console.log('='.repeat(80) + '\n');

    await connectDB();

    // First, find Joseph Tayou (his supervisor)
    const josephTayou = await User.findOne({ email: 'joseph.tayou@gratoglobal.com' });
    
    if (!josephTayou) {
      console.error('❌ ERROR: Joseph Tayou not found in database!');
      console.error('   Jules cannot be added without his supervisor.');
      process.exit(1);
    }

    console.log('✅ Found supervisor: Joseph Tayou');
    console.log('   ID:', josephTayou._id);
    console.log('   Position:', josephTayou.position);
    console.log('');

    // Check if Jules already exists
    const existingJules = await User.findOne({ email: 'jules.mouna@gratoglobal.com' });
    
    if (existingJules) {
      console.log('⚠️  Jules Mouna already exists in database');
      console.log('   Email:', existingJules.email);
      console.log('   Position:', existingJules.position);
      console.log('');
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('Do you want to update Jules\' details? (yes/no): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('Cancelled.');
        process.exit(0);
      }
      
      // Update existing user
      existingJules.password = 'Jules_Tech_6018#';
      existingJules.fullName = 'Mr. Jules Mouna';
      existingJules.role = 'technical';
      existingJules.department = 'Technical';
      existingJules.position = 'Field Technician';
      existingJules.hierarchyLevel = 1;
      existingJules.supervisor = josephTayou._id;
      existingJules.departmentHead = null; // Will be set by hierarchy system
      existingJules.directReports = [];
      existingJules.approvalCapacities = [];
      existingJules.departmentRole = 'staff';
      existingJules.permissions = [
        'view_own_requests',
        'create_requisition',
        'view_team_reports'
      ];
      existingJules.isActive = true;
      existingJules.hierarchyPath = [josephTayou._id.toString()];
      
      await existingJules.save();
      
      // Add Jules to Joseph's directReports
      if (!josephTayou.directReports.some(id => id.toString() === existingJules._id.toString())) {
        josephTayou.directReports.push(existingJules._id);
        await josephTayou.save();
        console.log('✅ Added Jules to Joseph\'s direct reports');
      }
      
      console.log('✅ Jules updated successfully!\n');
      await displayUserDetails(existingJules, josephTayou);
      
    } else {
      // Create new user
      const password = 'Jules_Tech_6018#';
      
      const julesData = {
        email: 'jules.mouna@gratoglobal.com',
        password: password,
        fullName: 'Mr. Jules Mouna',
        role: 'technical',
        department: 'Technical',
        position: 'Field Technician',
        hierarchyLevel: 1,
        supervisor: josephTayou._id,
        departmentHead: null, // Will be set by hierarchy system
        directReports: [],
        approvalCapacities: [],
        departmentRole: 'staff',
        permissions: [
          'view_own_requests',
          'create_requisition',
          'view_team_reports'
        ],
        isActive: true,
        hierarchyPath: [josephTayou._id.toString()]
      };

      const jules = new User(julesData);
      await jules.save();

      // Add Jules to Joseph's directReports
      josephTayou.directReports.push(jules._id);
      await josephTayou.save();

      console.log('✅ Jules created successfully!\n');
      await displayUserDetails(jules, josephTayou);
    }

    // Verify login
    await testLogin('jules.mouna@gratoglobal.com', 'Jules_Tech_6018#');

    // Display team structure
    await displayTeamStructure(josephTayou);

    console.log('\n✅ SETUP COMPLETE!');
    console.log('Jules Mouna is now a Field Technician reporting to Joseph Tayou.\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

async function displayUserDetails(user, supervisor) {
  console.log('📊 USER DETAILS');
  console.log('='.repeat(80));
  console.log(`Email              : ${user.email}`);
  console.log(`Full Name          : ${user.fullName}`);
  console.log(`Position           : ${user.position}`);
  console.log(`Department         : ${user.department}`);
  console.log(`Role               : ${user.role}`);
  console.log(`Hierarchy Level    : ${user.hierarchyLevel}`);
  console.log(`Supervisor         : ${supervisor.fullName} (${supervisor.email})`);
  console.log(`Department Role    : ${user.departmentRole}`);
  console.log(`Is Active          : ${user.isActive}`);
  console.log(`Permissions        : ${user.permissions.join(', ')}`);
  console.log('='.repeat(80) + '\n');

  console.log('🔐 LOGIN CREDENTIALS');
  console.log('='.repeat(80));
  console.log(`Email              : jules.mouna@gratoglobal.com`);
  console.log(`Password           : Jules_Tech_6018#`);
  console.log('='.repeat(80) + '\n');
}

async function testLogin(email, password) {
  console.log('🧪 TESTING LOGIN');
  console.log('='.repeat(80));
  
  try {
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
    }
    
  } catch (error) {
    console.error('❌ Login test error:', error.message);
  }
  
  console.log('='.repeat(80) + '\n');
}

async function displayTeamStructure(supervisor) {
  console.log('👥 TEAM STRUCTURE - JOSEPH TAYOU\'S TEAM');
  console.log('='.repeat(80));
  
  const team = await User.find({ 
    _id: { $in: supervisor.directReports } 
  }).select('fullName email position isActive');
  
  console.log(`\nSupervisor: ${supervisor.fullName}`);
  console.log(`Position: ${supervisor.position}`);
  console.log(`\nDirect Reports (${team.length}):`);
  
  team.forEach((member, index) => {
    const status = member.isActive ? '✅' : '❌';
    console.log(`  ${index + 1}. ${status} ${member.fullName}`);
    console.log(`     Position: ${member.position}`);
    console.log(`     Email: ${member.email}`);
    console.log('');
  });
  
  console.log('='.repeat(80) + '\n');
}

if (require.main === module) {
  addJulesTechnician();
}

module.exports = { addJulesTechnician };







// require('dotenv').config();
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const User = require('../models/User');

// const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// async function connectDB() {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log('✅ Connected to MongoDB Atlas\n');
//   } catch (error) {
//     console.error('❌ Connection failed:', error.message);
//     process.exit(1);
//   }
// }

// async function addTomOverseer() {
//   try {
//     console.log('🔧 ADDING TOM - GENERAL OVERSEER');
//     console.log('='.repeat(80) + '\n');

//     await connectDB();

//     // Check if Tom already exists
//     const existingTom = await User.findOne({ email: 'tom@gratoengineering.com' });
    
//     if (existingTom) {
//       console.log('⚠️  Tom already exists in database');
//       console.log('   Email:', existingTom.email);
//       console.log('   Position:', existingTom.position);
//       console.log('');
      
//       const readline = require('readline').createInterface({
//         input: process.stdin,
//         output: process.stdout
//       });
      
//       const answer = await new Promise(resolve => {
//         readline.question('Do you want to update Tom\'s details? (yes/no): ', resolve);
//       });
//       readline.close();
      
//       if (answer.toLowerCase() !== 'yes') {
//         console.log('Cancelled.');
//         process.exit(0);
//       }
      
//       // Update existing user
//       existingTom.password = 'cEo01@Grato#';
//       existingTom.fullName = 'Mr. Tom';
//       existingTom.role = 'admin';
//       existingTom.department = 'CEO Office';
//       existingTom.position = 'General Overseer';
//       existingTom.hierarchyLevel = 6;
//       existingTom.supervisor = null;
//       existingTom.departmentHead = null;
//       existingTom.directReports = [];
//       existingTom.approvalCapacities = ['business_head'];
//       existingTom.permissions = [
//         'all_access',
//         'user_management',
//         'team_management',
//         'financial_approval',
//         'executive_decisions',
//         'system_settings',
//         'view_reports',
//         'company_reports'
//       ];
//       existingTom.isActive = true;
//       existingTom.hierarchyPath = [];
      
//       await existingTom.save();
      
//       console.log('✅ Tom updated successfully!\n');
//       await displayUserDetails(existingTom);
      
//     } else {
//       // Create new user
//       const password = 'cEo01@Grato#';
      
//       const tomData = {
//         email: 'tom@gratoengineering.com',
//         password: password,
//         fullName: 'Mr. Tom',
//         role: 'admin',
//         department: 'CEO Office',
//         position: 'General Overseer',
//         hierarchyLevel: 6,
//         supervisor: null,
//         departmentHead: null,
//         directReports: [],
//         approvalCapacities: ['business_head'],  // CHANGED
//         permissions: [
//         'all_access',
//         'user_management',
//         'team_management',
//         'financial_approval',
//         'executive_decisions',
//         'system_settings',
//         'view_reports',
//         'company_reports'
//         ],
//         isActive: true,
//         hierarchyPath: []
//     };

//       const tom = new User(tomData);
//       await tom.save();

//       console.log('✅ Tom created successfully!\n');
//       await displayUserDetails(tom);
//     }

//     // Now update Kelvin to report to Tom
//     console.log('🔄 Updating Kelvin to report to Tom...\n');
    
//     const kelvin = await User.findOne({ email: 'kelvin.eyong@gratoglobal.com' });
    
//     if (kelvin) {
//       const tom = await User.findOne({ email: 'tom@gratoengineering.com' });
      
//       kelvin.supervisor = tom._id;
//       await kelvin.save();
      
//       // Add Kelvin to Tom's directReports
//       if (!tom.directReports.includes(kelvin._id)) {
//         tom.directReports.push(kelvin._id);
//         await tom.save();
//       }
      
//       console.log('✅ Kelvin now reports to Tom');
//       console.log('   Kelvin:', kelvin.fullName);
//       console.log('   Supervisor:', tom.fullName);
//       console.log('');
//     } else {
//       console.log('⚠️  Kelvin not found - skipping hierarchy update');
//     }

//     // Verify login
//     await testLogin('tom@gratoengineering.com', 'cEo01@Grato#');

//     console.log('\n✅ SETUP COMPLETE!');
//     console.log('Tom is now the General Overseer in CEO Office with access to company reports.\n');
    
//     process.exit(0);

//   } catch (error) {
//     console.error('\n❌ Setup failed:', error);
//     console.error(error.stack);
//     process.exit(1);
//   }
// }

// async function displayUserDetails(user) {
//   console.log('📊 USER DETAILS');
//   console.log('='.repeat(80));
//   console.log(`Email              : ${user.email}`);
//   console.log(`Full Name          : ${user.fullName}`);
//   console.log(`Position           : ${user.position}`);
//   console.log(`Department         : ${user.department}`);
//   console.log(`Role               : ${user.role}`);
//   console.log(`Hierarchy Level    : ${user.hierarchyLevel}`);
//   console.log(`Is Active          : ${user.isActive}`);
//   console.log(`Approval Capacities: ${user.approvalCapacities.join(', ')}`);
//   console.log('='.repeat(80) + '\n');

//   console.log('🔐 LOGIN CREDENTIALS');
//   console.log('='.repeat(80));
//   console.log(`Email              : tom@gratoengineering.com`);
//   console.log(`Password           : cEo01@Grato#`);
//   console.log('='.repeat(80) + '\n');
// }

// async function testLogin(email, password) {
//   console.log('🧪 TESTING LOGIN');
//   console.log('='.repeat(80));
  
//   try {
//     const user = await User.findOne({ email });
    
//     if (!user) {
//       console.log('❌ User not found');
//       return;
//     }

//     if (!user.isActive) {
//       console.log('❌ User is not active');
//       return;
//     }

//     const isValidPassword = await user.comparePassword(password);
    
//     if (isValidPassword) {
//       console.log('✅ LOGIN TEST PASSED!');
//       console.log('   Email:', email);
//       console.log('   Password comparison: SUCCESS');
//       console.log('   User is active: YES');
//     } else {
//       console.log('❌ LOGIN TEST FAILED - Password comparison returned false');
//     }
    
//   } catch (error) {
//     console.error('❌ Login test error:', error.message);
//   }
  
//   console.log('='.repeat(80) + '\n');
// }

// if (require.main === module) {
//   addTomOverseer();
// }

// module.exports = { addTomOverseer };