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

async function addEstherLum() {
  try {
    console.log('🌱 ADDING ESTHER LUM');
    console.log('='.repeat(80) + '\n');

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'esther.lum@gratoglobal.com' });
    if (existingUser) {
      console.log('⚠️  User with email esther.lum@gratoglobal.com already exists!');
      console.log('User details:', {
        fullName: existingUser.fullName,
        position: existingUser.position,
        department: existingUser.department,
        isActive: existingUser.isActive
      });
      
      const args = process.argv.slice(2);
      if (!args.includes('--force')) {
        console.log('\nTo replace this user, run: node scripts/addEstherLum.js --force\n');
        process.exit(0);
      }
      
      console.log('🗑️  Deleting existing user...');
      await User.deleteOne({ email: 'esther.lum@gratoglobal.com' });
      console.log('✅ Existing user deleted\n');
    }

    // Find supervisor (Bruiline Tsitoh - HR & Admin Head)
    const supervisor = await User.findOne({ email: 'bruiline.tsitoh@gratoglobal.com' });
    
    if (!supervisor) {
      console.error('❌ Supervisor not found: bruiline.tsitoh@gratoglobal.com');
      console.log('Please ensure Bruiline Tsitoh exists in the database first.');
      process.exit(1);
    }

    console.log(`✅ Found supervisor: ${supervisor.fullName} (${supervisor.email})\n`);

    // Hash password using bcrypt (same as in User model pre-save hook)
    // Password format: LastName_Dept_####[Special]
    const password = 'Lum_HR_5823@';
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user data
    const userData = {
      email: 'esther.lum@gratoglobal.com',
      password: hashedPassword,
      fullName: 'Esther Lum',
      role: 'employee',
      isActive: true,
      department: 'HR & Admin',
      position: 'HR Assistant',
      hierarchyLevel: 2,
      departmentRole: 'staff',
      
      // Hierarchy references
      supervisor: supervisor._id,
      departmentHead: supervisor._id, // Bruiline is both supervisor and dept head
      directReports: [],
      approvalCapacities: [],
      permissions: ['basic_access', 'view_own_data', 'submit_requests'],
      
      // Hierarchy path (from Esther -> Bruiline -> Kelvin)
      hierarchyPath: [],
      
      // Supplier details with default values
      supplierDetails: {
        address: {
          country: 'Cameroon'
        },
        documents: {
          additionalDocuments: []
        },
        servicesOffered: [],
        paymentTerms: '30 days NET'
      },
      
      // Buyer details with default values
      buyerDetails: {
        workload: {
          currentAssignments: 0,
          monthlyTarget: 50
        },
        performance: {
          completedOrders: 0,
          averageProcessingTime: 0,
          customerSatisfactionRating: 5
        },
        availability: {
          isAvailable: true
        },
        specializations: [],
        maxOrderValue: 1000000
      },
      
      supplierStatus: {
        accountStatus: 'pending',
        emailVerified: false,
        isVerified: false
      },
      
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: new Date()
    };

    // Build hierarchy path
    if (supervisor.supervisor) {
      userData.hierarchyPath = [supervisor._id.toString(), supervisor.supervisor.toString()];
    } else {
      userData.hierarchyPath = [supervisor._id.toString()];
    }

    // Create and save the user
    const newUser = new User(userData);
    await newUser.save();

    console.log('✅ User created successfully!\n');

    // Update supervisor's directReports
    if (!supervisor.directReports.includes(newUser._id)) {
      supervisor.directReports.push(newUser._id);
      await supervisor.save();
      console.log(`✅ Added to supervisor's direct reports\n`);
    }

    // Display user details
    console.log('📊 USER DETAILS');
    console.log('='.repeat(80));
    console.log(`Email              : ${newUser.email}`);
    console.log(`Full Name          : ${newUser.fullName}`);
    console.log(`Role               : ${newUser.role}`);
    console.log(`Department         : ${newUser.department}`);
    console.log(`Position           : ${newUser.position}`);
    console.log(`Hierarchy Level    : ${newUser.hierarchyLevel}`);
    console.log(`Is Active          : ${newUser.isActive}`);
    console.log(`Supervisor         : ${supervisor.fullName} (${supervisor.email})`);
    console.log(`Department Head    : ${supervisor.fullName} (${supervisor.email})`);
    console.log(`Hierarchy Path     : ${userData.hierarchyPath.join(' -> ')}`);
    console.log('='.repeat(80) + '\n');

    console.log('🔐 LOGIN CREDENTIALS');
    console.log('='.repeat(80));
    console.log(`Email              : esther.lum@gratoglobal.com`);
    console.log(`Password           : ${password}`);
    console.log(`Format             : LastName_Dept_RandomNumber[Special]`);
    console.log('='.repeat(80) + '\n');

    console.log('✅ ESTHER LUM ADDED SUCCESSFULLY!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Failed to add user:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addEstherLum();
}

module.exports = { addEstherLum };