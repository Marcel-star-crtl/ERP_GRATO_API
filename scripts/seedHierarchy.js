// scripts/seedHierarchy.js - COMPLETE FIXED VERSION
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// FIXED: Supply chain team with correct departmentRole values
const SUPPLY_CHAIN_TEAM = [
  {
    name: 'Mr. Lukong Lambert',
    email: 'lukong.lambert@gratoglobal.com',
    position: 'Supply Chain Coordinator',
    department: 'Business Development & Supply Chain',
    role: 'supervisor',
    departmentRole: 'supervisor', // Valid enum value
    hierarchyLevel: 3,
    supervisor: 'Head of Business Dev & Supply Chain',
    permissions: [
      'supply_chain_management',
      'buyer_assignment',
      'vendor_management',
      'procurement_oversight',
      'inventory_management'
    ]
  },
  {
    name: 'Mr. Cristabel Maneni',
    email: 'christabel@gratoengineering.com',
    position: 'Order Management Assistant/Buyer',
    department: 'Business Development & Supply Chain',
    role: 'employee',
    departmentRole: 'buyer', // Valid enum value - this is the key fix
    hierarchyLevel: 2,
    supervisor: 'Supply Chain Coordinator',
    specializations: ['Office_Supplies', 'Consumables', 'General'],
    maxOrderValue: 2000000,
    permissions: [
      'purchase_orders',
      'supplier_communication',
      'order_processing',
      'basic_procurement'
    ]
  },
  {
    name: 'Mr. Pryde Mua',
    email: 'pryde.mua@gratoglobal.com',
    position: 'Warehouse Coordinator/Buyer',
    department: 'Business Development & Supply Chain',
    role: 'employee',
    departmentRole: 'buyer', // Valid enum value - this is the key fix
    hierarchyLevel: 2,
    supervisor: 'Supply Chain Coordinator',
    specializations: ['Equipment', 'Hardware', 'Maintenance_Supplies'],
    maxOrderValue: 5000000,
    permissions: [
      'purchase_orders',
      'supplier_communication',
      'order_processing',
      'warehouse_management',
      'inventory_control'
    ]
  },
  {
    name: 'Ms. Aghangu Marie',
    email: 'aghangu.marie@gratoengineering.com',
    position: 'Warehouse Assistant',
    department: 'Business Development & Supply Chain',
    role: 'employee',
    departmentRole: 'staff', // Valid enum value
    hierarchyLevel: 1,
    supervisor: 'Warehouse Coordinator',
    permissions: [
      'inventory_support',
      'stock_management'
    ]
  },
  {
    name: 'Ms. Rambell Mambo',
    email: 'ranibellmambo@gratoengineering.com',
    position: 'Finance Officer',
    department: 'Business Development & Supply Chain',
    role: 'finance', // Main role stays as finance
    departmentRole: 'staff', // FIXED: Changed from 'finance' to 'staff' (valid enum)
    hierarchyLevel: 3,
    supervisor: 'Head of Business Dev & Supply Chain',
    permissions: [
      'budget_verification',
      'financial_approval',
      'cost_analysis',
      'budget_management'
    ]
  }
];

async function connectToDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/grato-engineering';
    // FIXED: Removed deprecated connection options
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
}

async function findSupervisorId(supervisorName) {
  if (supervisorName === 'Head of Business Dev & Supply Chain') {
    const supervisor = await User.findOne({ 
      $or: [
        { fullName: 'Mr. E.T Kelvin' },
        { email: 'kelvin.eyong@gratoglobal.com' }
      ]
    });
    return supervisor?._id;
  }
  
  if (supervisorName === 'Supply Chain Coordinator') {
    const supervisor = await User.findOne({
      email: 'lukong.lambert@gratoglobal.com'
    });
    return supervisor?._id;
  }
  
  if (supervisorName === 'Warehouse Coordinator') {
    const supervisor = await User.findOne({
      email: 'pryde.mua@gratoglobal.com'
    });
    return supervisor?._id;
  }
  
  return null;
}

async function seedEmployee(employeeData) {
  try {
    console.log(`🌱 Seeding ${employeeData.name}...`);
    
    const defaultPassword = process.env.DEFAULT_PASSWORD || 'GratoEng2024!';
    
    // Check if employee already exists
    const existingUser = await User.findOne({ email: employeeData.email });
    if (existingUser) {
      console.log(`⏩ Employee already exists: ${employeeData.name}`);
      
      try {
        // Update existing user with correct details
        const supervisorId = await findSupervisorId(employeeData.supervisor);
        
        existingUser.role = employeeData.role;
        existingUser.department = employeeData.department;
        existingUser.departmentRole = employeeData.departmentRole; // This is the critical fix
        existingUser.hierarchyLevel = employeeData.hierarchyLevel;
        existingUser.permissions = employeeData.permissions;
        
        // Handle buyer details for employees with departmentRole 'buyer'
        if (employeeData.departmentRole === 'buyer') {
          existingUser.buyerDetails = {
            specializations: employeeData.specializations || [],
            maxOrderValue: employeeData.maxOrderValue || 1000000,
            workload: {
              currentAssignments: existingUser.buyerDetails?.workload?.currentAssignments || 0,
              monthlyTarget: 50
            },
            performance: {
              completedOrders: existingUser.buyerDetails?.performance?.completedOrders || 0,
              averageProcessingTime: existingUser.buyerDetails?.performance?.averageProcessingTime || 0,
              customerSatisfactionRating: existingUser.buyerDetails?.performance?.customerSatisfactionRating || 5
            },
            availability: {
              isAvailable: true,
              unavailableReason: null,
              unavailableUntil: null
            }
          };
        }
        
        if (supervisorId) {
          existingUser.supervisor = supervisorId;
        }
        
        await existingUser.save();
        console.log(`✅ Updated existing user: ${employeeData.name}`);
        return existingUser;
        
      } catch (updateError) {
        console.error(`❌ Error updating ${employeeData.name}:`, updateError.message);
        throw updateError;
      }
    }
    
    // Create new user if doesn't exist
    const supervisorId = await findSupervisorId(employeeData.supervisor);
    
    const userData = {
      email: employeeData.email,
      password: defaultPassword,
      fullName: employeeData.name,
      role: employeeData.role,
      department: employeeData.department,
      departmentRole: employeeData.departmentRole,
      hierarchyLevel: employeeData.hierarchyLevel,
      permissions: employeeData.permissions,
      isActive: true,
      createdAt: new Date()
    };
    
    // Add buyer details for employees with departmentRole 'buyer'
    if (employeeData.departmentRole === 'buyer') {
      userData.buyerDetails = {
        specializations: employeeData.specializations || [],
        maxOrderValue: employeeData.maxOrderValue || 1000000,
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
          isAvailable: true,
          unavailableReason: null,
          unavailableUntil: null
        }
      };
    }
    
    if (supervisorId) {
      userData.supervisor = supervisorId;
    }
    
    const user = new User(userData);
    await user.save();
    
    console.log(`✅ Created: ${employeeData.name} (${employeeData.position})`);
    return user;
    
  } catch (error) {
    console.error(`❌ Error seeding ${employeeData.name}:`, error.message);
    throw error;
  }
}

async function updateSupervisorRelationships() {
  try {
    console.log('🔗 Updating supervisor relationships...');
    
    for (const employeeData of SUPPLY_CHAIN_TEAM) {
      const employee = await User.findOne({ email: employeeData.email });
      if (!employee) continue;
      
      const supervisorId = await findSupervisorId(employeeData.supervisor);
      if (!supervisorId) continue;
      
      const supervisor = await User.findById(supervisorId);
      if (!supervisor) continue;
      
      // Add employee to supervisor's direct reports if not already there
      if (!supervisor.directReports.includes(employee._id)) {
        supervisor.directReports.push(employee._id);
        await supervisor.save();
      }
      
      // Update employee's supervisor field if not already set
      if (!employee.supervisor || employee.supervisor.toString() !== supervisorId.toString()) {
        employee.supervisor = supervisorId;
        await employee.save();
      }
    }
    
    console.log('✅ Updated supervisor relationships');
    
  } catch (error) {
    console.error('❌ Error updating supervisor relationships:', error);
  }
}

async function verifyPresident() {
  try {
    console.log('👨‍💼 Verifying president exists...');
    
    // FIXED: Properly check for existing president first
    const existingPresident = await User.findOne({
      $or: [
        { fullName: 'Mr. E.T Kelvin' },
        { email: 'kelvin.eyong@gratoglobal.com' }
      ]
    });
    
    if (existingPresident) {
      console.log('✅ President already exists: Mr. E.T Kelvin');
      
      // Update existing president if needed
      if (existingPresident.role !== 'admin') {
        existingPresident.role = 'admin';
        existingPresident.departmentRole = 'head';
        existingPresident.permissions = ['all_access', 'user_management', 'team_management', 'financial_approval', 'executive_decisions'];
        await existingPresident.save();
        console.log('✅ Updated president permissions');
      }
      
      return existingPresident;
    }
    
    // Only create if doesn't exist
    console.log('Creating new president...');
    
    const defaultPassword = process.env.DEFAULT_PASSWORD || 'GratoEng2024!';
    
    const presidentData = {
      email: 'kelvin.eyong@gratoglobal.com',
      password: defaultPassword,
      fullName: 'Mr. E.T Kelvin',
      role: 'admin',
      department: 'Business Development & Supply Chain',
      departmentRole: 'head',
      hierarchyLevel: 5,
      permissions: ['all_access', 'user_management', 'team_management', 'financial_approval', 'executive_decisions'],
      isActive: true,
      createdAt: new Date()
    };
    
    const presidentUser = new User(presidentData);
    await presidentUser.save();
    console.log('✅ Created president: Mr. E.T Kelvin');
    return presidentUser;
    
  } catch (error) {
    console.error('❌ Error in verifyPresident:', error.message);
    // Don't throw error, just continue with seeding
    return null;
  }
}

async function seedDatabase() {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Seeding Supply Chain Team');
    console.log('===============================\n');
    
    await connectToDatabase();
    await verifyPresident();
    
    // Seed employees in order (supervisors first)
    const orderedEmployees = [
      SUPPLY_CHAIN_TEAM.find(emp => emp.email === 'lukong.lambert@gratoglobal.com'), // Coordinator first
      SUPPLY_CHAIN_TEAM.find(emp => emp.email === 'christabel@gratoengineering.com'), // Buyer 1
      SUPPLY_CHAIN_TEAM.find(emp => emp.email === 'pryde.mua@gratoglobal.com'), // Buyer 2
      SUPPLY_CHAIN_TEAM.find(emp => emp.email === 'aghangu.marie@gratoengineering.com'), // Assistant
      SUPPLY_CHAIN_TEAM.find(emp => emp.email === 'ranibellmambo@gratoengineering.com') // Finance
    ].filter(Boolean);
    
    const createdUsers = [];
    for (const employeeData of orderedEmployees) {
      try {
        const user = await seedEmployee(employeeData);
        if (user) createdUsers.push(user);
      } catch (employeeError) {
        console.error(`Skipping ${employeeData.name} due to error:`, employeeError.message);
        continue; // Continue with other employees
      }
    }
    
    // Update relationships after all users are created
    await updateSupervisorRelationships();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Seeding completed in ${duration} seconds`);
    
    // Display login information
    console.log('\n📋 Supply Chain Team Login Information:');
    console.log('=========================================');
    
    for (const employeeData of SUPPLY_CHAIN_TEAM) {
      console.log(`\n${employeeData.name}:`);
      console.log(`   Email: ${employeeData.email}`);
      console.log(`   Password: ${process.env.DEFAULT_PASSWORD || 'GratoEng2024!'}`);
      console.log(`   Role: ${employeeData.role}`);
      console.log(`   Department Role: ${employeeData.departmentRole}`);
      console.log(`   Position: ${employeeData.position}`);
      
      if (employeeData.departmentRole === 'buyer') {
        console.log(`   Buyer Specializations: ${employeeData.specializations?.join(', ')}`);
        console.log(`   Max Order Value: XAF ${employeeData.maxOrderValue?.toLocaleString()}`);
      }
    }
    
    console.log('\n👥 Team Structure:');
    console.log('==================');
    console.log('Mr. E.T Kelvin (President)');
    console.log('├── Mr. Lukong Lambert (Supply Chain Coordinator)');
    console.log('│   ├── Mr. Cristabel Maneni (Buyer - Office Supplies)');
    console.log('│   ├── Mr. Pryde Mua (Buyer - Equipment & Hardware)');
    console.log('│   └── Ms. Aghangu Marie (Warehouse Assistant)');
    console.log('└── Ms. Rambell Mambo (Finance Officer)');
    
    console.log('\n✅ All Issues Fixed:');
    console.log('====================');
    console.log('• Removed deprecated MongoDB connection options');
    console.log('• Fixed duplicate key error by properly checking existing users');
    console.log('• Fixed Rambell departmentRole: "finance" → "staff" (valid enum)');
    console.log('• Fixed Cristabel & Pryde: role="employee", departmentRole="buyer"');
    console.log('• Added proper error handling for individual employee failures');
    console.log('• Configured buyer details correctly for both buyers');
    
  } catch (error) {
    console.error('\n❌ SEEDING FAILED:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Execute if run directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };






// // scripts/seedDatabase.js
// const mongoose = require('mongoose');
// const User = require('../models/User'); 
// require('dotenv').config();

// const DEPARTMENT_STRUCTURE = {
//   'Technical': {
//       name: 'Technical',
//       head: 'Mr. Didier Oyong',
//       headEmail: 'didier.oyong@gratoengineering.com',
//       positions: {
//           'HSE Coordinator': {
//               name: 'Mr. Ovo Becheni',
//               email: 'bechem.mbu@gratoglobal.com',
//               supervisor: 'Technical Director', 
//               department: 'Technical'
//           },
//           'Head of Refurbishment': {
//               name: 'Mr. Yerla Ivo',
//               email: 'verla.ivo@gratoengineering.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Project Manager': {
//               name: 'Mr. Joel Wamba',
//               email: 'joel@gratoengineering.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Operations Manager': {
//               name: 'Mr. Pascal Assam',
//               email: 'pascal.rodrique@gratoglobal.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Diesel Coordinator': {
//               name: 'Mr. Kevin Minka',
//               email: 'minka.kevin@gratoglobal.com',
//               supervisor: 'Technical Director',
//               department: 'Technical'
//           },
//           'Data Collector': {
//               name: 'Mr. Bomba Yvone',
//               email: 'bemba.essack@gratoglobal.com',
//               supervisor: 'Operations Manager',
//               department: 'Technical'
//           },
//           'NOC Coordinator': {
//               name: 'Mr. Rodrigue Nono',
//               email: 'rodrigue.nono@gratoglobal.com',
//               supervisor: 'Diesel Coordinator',
//               department: 'Technical'
//           },
//           'Site Supervisor': {
//               name: 'Site Supervisors', 
//               email: 'site.supervisors@gratoengineering.com', 
//               supervisor: 'Project Manager',
//               department: 'Technical'
//           },
//           'Field Technician': { 
//               name: 'Field Technicians', 
//               email: 'field.technicians@gratoengineering.com', 
//               supervisor: 'Site Supervisor', 
//               department: 'Technical'
//           },
//           'NOC Operator': { 
//               name: 'NOC Operators', 
//               email: 'noc.operators@gratoengineering.com', 
//               supervisor: 'NOC Coordinator',
//               department: 'Technical'
//           }
//       }
//   },

//   'Business Development & Supply Chain': {
//       name: 'Business Development & Supply Chain',
//       head: 'Mr. E.T Kelvin',
//       headEmail: 'kelvin.eyong@gratoglobal.com',
//       positions: {
//           'Supply Chain Coordinator': {
//               name: 'Mr. Lukong Lambert',
//               email: 'lukong.lambert@gratoglobal.com',
//               supervisor: 'Head of Business Dev & Supply Chain', 
//               department: 'Business Development & Supply Chain'
//           },
//           'Order Management Assistant': {
//               name: 'Mr. Cristabel Maneni',
//               email: 'christabel@gratoengineering.com',
//               supervisor: 'Supply Chain Coordinator',
//               department: 'Business Development & Supply Chain'
//           },
//           'Warehouse Coordinator': {
//               name: 'Mr. Pryde Mua',
//               email: 'pryde.mua@gratoglobal.com',
//               supervisor: 'Supply Chain Coordinator',
//               department: 'Business Development & Supply Chain'
//           },
//           'Warehouse Assistant': {
//               name: 'Ms. Aghangu Marie',
//               email: 'aghangu.marie@gratoengineering.com',
//               supervisor: 'Warehouse Coordinator',
//               department: 'Business Development & Supply Chain'
//           },
//           'Finance Officer': {
//               name: 'Ms. Rambell Mambo',
//               email: 'ranibellmambo@gratoengineerinng.com',
//               supervisor: 'Head of Business Dev & Supply Chain', 
//               department: 'Business Development & Supply Chain'
//           }
//       }
//   },

//   'HR & Admin': {
//       name: 'HR & Admin',
//       head: 'Mrs. Brunline Teitoh',
//       headEmail: 'brunline.teitoh@gratoengineering.com',
//       positions: {
//           'Office Driver/Logistics Assistant': {
//               name: 'Mr. Che Earnest',
//               email: 'che.earnest@gratoengineering.com',
//               supervisor: 'HR & Admin Head', 
//               department: 'HR & Admin'
//           },
//           'IT Officer': {
//               name: 'Mr. Ngong Marcel',
//               email: 'marcel.ngong@gratoglobal.com',
//               supervisor: 'HR & Admin Head', 
//               department: 'HR & Admin'
//           },
//           'House Maid': {
//               name: 'Ms. Ndi Belther',
//               email: 'ndi.belther@gratoengineering.com',
//               supervisor: 'HR & Admin Head', 
//               department: 'HR & Admin'
//           }
//       }
//   },

//   'Executive': {
//       name: 'Executive',
//       head: 'Mr. Tom Omeje',
//       headEmail: 'tom.omeje@gratoengineering.com',
//       positions: {
//           'Technical Director': {
//               name: 'Mr. Didier Oyong',
//               email: 'didier.oyong@gratoengineering.com',
//               supervisor: 'President',
//               department: 'Executive'
//           },
//           'Head of Business Dev & Supply Chain': {
//               name: 'Mr. E.T Kelvin',
//               email: 'kelvin.eyong@gratoglobal.com',
//               supervisor: 'President',
//               department: 'Executive'
//           },
//           'Head of HR & Admin': { 
//               name: 'Mrs. Brunline Teitoh',
//               email: 'brunline.teitoh@gratoengineering.com',
//               supervisor: 'President',
//               department: 'Executive'
//           }
//       }
//   }
// };

// // Role mapping based on organizational structure
// const ROLE_MAPPING = {
//   // Executive Level
//   'Mr. Tom Omeje': 'admin',
  
//   // Department Heads (admin level)
//   'Mr. Didier Oyong': 'admin',
//   'Mr. E.T Kelvin': 'admin', 
//   'Mrs. Brunline Teitoh': 'admin',
  
//   // Senior Management (supervisor level)
//   'Mr. Ovo Becheni': 'supervisor',
//   'Mr. Yerla Ivo': 'supervisor',
//   'Mr. Joel Wamba': 'supervisor',
//   'Mr. Pascal Assam': 'supervisor',
//   'Mr. Kevin Minka': 'supervisor',
//   'Mr. Lukong Lambert': 'supervisor',
//   'Mr. Pryde Mua': 'supervisor',
  
//   // Finance specific
//   'Ms. Rambell Mambo': 'finance',
  
//   // IT specific  
//   'Mr. Ngong Marcel': 'it',
  
//   // Coordinators and mid-level (supervisor)
//   'Mr. Rodrigue Nono': 'supervisor',
//   'Site Supervisors': 'supervisor',
  
//   // Staff level (employee)
//   'Mr. Bomba Yvone': 'employee',
//   'Mr. Cristabel Maneni': 'employee',
//   'Ms. Aghangu Marie': 'employee',
//   'Mr. Che Earnest': 'employee',
//   'Ms. Ndi Belther': 'employee',
//   'Field Technicians': 'employee',
//   'NOC Operators': 'employee'
// };

// // Department role mapping
// const DEPARTMENT_ROLE_MAPPING = {
//   'Executive': {
//     'Mr. Tom Omeje': 'head',
//     'Mr. Didier Oyong': 'head',
//     'Mr. E.T Kelvin': 'head',
//     'Mrs. Brunline Teitoh': 'head'
//   },
//   'Technical': {
//     'Mr. Didier Oyong': 'head',
//     'Mr. Ovo Becheni': 'coordinator',
//     'Mr. Yerla Ivo': 'supervisor',
//     'Mr. Joel Wamba': 'supervisor',
//     'Mr. Pascal Assam': 'supervisor',
//     'Mr. Kevin Minka': 'coordinator',
//     'Mr. Rodrigue Nono': 'coordinator',
//     'Site Supervisors': 'supervisor',
//     'Mr. Bomba Yvone': 'staff',
//     'Field Technicians': 'staff',
//     'NOC Operators': 'staff'
//   },
//   'Business Development & Supply Chain': {
//     'Mr. E.T Kelvin': 'head',
//     'Mr. Lukong Lambert': 'coordinator',
//     'Mr. Pryde Mua': 'coordinator',
//     'Ms. Rambell Mambo': 'staff',
//     'Mr. Cristabel Maneni': 'staff',
//     'Ms. Aghangu Marie': 'staff'
//   },
//   'HR & Admin': {
//     'Mrs. Brunline Teitoh': 'head',
//     'Mr. Ngong Marcel': 'staff',
//     'Mr. Che Earnest': 'staff',
//     'Ms. Ndi Belther': 'staff'
//   }
// };

// // Helper function to get hierarchy level
// const getHierarchyLevel = (name, department) => {
//   if (name === 'Mr. Tom Omeje') return 5; // President
  
//   const dept = DEPARTMENT_STRUCTURE[department];
//   if (!dept) return 1;
  
//   if (dept.head === name) return 4; // Department Head
  
//   // Check positions for hierarchy levels
//   for (const [position, data] of Object.entries(dept.positions || {})) {
//     if (data.name === name) {
//       if (position.includes('Head') || position.includes('Director')) return 4;
//       if (position.includes('Manager') || position.includes('Coordinator')) return 3;
//       if (position.includes('Supervisor')) return 2;
//       return 1; // Staff level
//     }
//   }
  
//   return 1;
// };

// // Helper function to find supervisor user ID
// const findSupervisorId = async (supervisorName, department) => {
//   if (supervisorName === 'President') {
//     const president = await User.findOne({ fullName: 'Mr. Tom Omeje' });
//     return president?._id;
//   }
  
//   if (supervisorName.includes('Head') || supervisorName.includes('Director')) {
//     const dept = DEPARTMENT_STRUCTURE[department];
//     if (dept?.head) {
//       const supervisor = await User.findOne({ fullName: dept.head });
//       return supervisor?._id;
//     }
//   }
  
//   // Search for supervisor by name in all departments
//   for (const [deptKey, deptData] of Object.entries(DEPARTMENT_STRUCTURE)) {
//     if (deptData.head === supervisorName) {
//       const supervisor = await User.findOne({ fullName: supervisorName });
//       return supervisor?._id;
//     }
    
//     for (const [position, data] of Object.entries(deptData.positions || {})) {
//       if (data.name === supervisorName || position === supervisorName) {
//         const supervisor = await User.findOne({ fullName: data.name });
//         return supervisor?._id;
//       }
//     }
//   }
  
//   return null;
// };

// // Helper function to find department head user ID
// const findDepartmentHeadId = async (department) => {
//   const dept = DEPARTMENT_STRUCTURE[department];
//   if (dept?.head) {
//     const head = await User.findOne({ fullName: dept.head });
//     return head?._id;
//   }
//   return null;
// };

// // Generate all employees data
// const getAllEmployees = () => {
//   const allEmployees = [];
  
//   Object.keys(DEPARTMENT_STRUCTURE).forEach(department => {
//     const dept = DEPARTMENT_STRUCTURE[department];
    
//     // Add department head if not Executive
//     if (department !== 'Executive') {
//       allEmployees.push({
//         name: dept.head,
//         email: dept.headEmail,
//         position: 'Department Head',
//         department: department,
//         supervisor: 'President',
//         role: ROLE_MAPPING[dept.head] || 'admin',
//         departmentRole: 'head'
//       });
//     }
    
//     // Add other positions
//     for (const [position, data] of Object.entries(dept.positions || {})) {
//       allEmployees.push({
//         name: data.name,
//         email: data.email,
//         position: position,
//         department: department,
//         supervisor: data.supervisor,
//         role: ROLE_MAPPING[data.name] || 'employee',
//         departmentRole: DEPARTMENT_ROLE_MAPPING[department]?.[data.name] || 'staff'
//       });
//     }
//   });
  
//   return allEmployees;
// };

// // Sample supplier data
// const sampleSuppliers = [
//   {
//     email: 'contact@techsupplier.com',
//     fullName: 'Tech Supplier Ltd',
//     role: 'supplier',
//     supplierDetails: {
//       companyName: 'Tech Supplier Ltd',
//       contactName: 'John Smith',
//       phoneNumber: '+237 123 456 789',
//       address: {
//         street: '123 Business Street',
//         city: 'Douala',
//         state: 'Littoral',
//         country: 'Cameroon',
//         postalCode: '12345'
//       },
//       businessRegistrationNumber: 'RC/DLA/2020/B/123',
//       taxIdNumber: 'TAX123456789',
//       supplierType: 'Technical',
//       bankDetails: {
//         bankName: 'Commercial Bank of Cameroon',
//         accountName: 'Tech Supplier Ltd',
//         accountNumber: '12345678901',
//         routingNumber: 'CBC001'
//       },
//       businessInfo: {
//         yearsInBusiness: 5,
//         primaryServices: ['IT Equipment', 'Technical Support', 'Software Licensing'],
//         certifications: ['ISO 9001', 'Technical Certification'],
//         website: 'www.techsupplier.com'
//       }
//     },
//     supplierStatus: {
//       accountStatus: 'approved',
//       isVerified: true,
//       emailVerified: true,
//       approvalDate: new Date()
//     }
//   },
//   {
//     email: 'info@hsesafety.com',
//     fullName: 'HSE Safety Solutions',
//     role: 'supplier',
//     supplierDetails: {
//       companyName: 'HSE Safety Solutions',
//       contactName: 'Marie Dubois',
//       phoneNumber: '+237 987 654 321',
//       address: {
//         street: '456 Safety Avenue',
//         city: 'Yaounde',
//         state: 'Centre',
//         country: 'Cameroon',
//         postalCode: '54321'
//       },
//       businessRegistrationNumber: 'RC/YAO/2019/B/456',
//       taxIdNumber: 'TAX987654321',
//       supplierType: 'HSE',
//       bankDetails: {
//         bankName: 'Afriland First Bank',
//         accountName: 'HSE Safety Solutions',
//         accountNumber: '98765432109',
//         routingNumber: 'AFL001'
//       },
//       businessInfo: {
//         yearsInBusiness: 8,
//         primaryServices: ['Safety Equipment', 'HSE Training', 'Risk Assessment'],
//         certifications: ['OHSAS 18001', 'ISO 45001'],
//         website: 'www.hsesafety.com'
//       }
//     },
//     supplierStatus: {
//       accountStatus: 'approved',
//       isVerified: true,
//       emailVerified: true,
//       approvalDate: new Date()
//     }
//   }
// ];

// // Connect to database
// async function connectToDatabase() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grato-engineering', {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log('Connected to MongoDB');
//   } catch (error) {
//     console.error('Database connection error:', error);
//     process.exit(1);
//   }
// }

// // Seed users function
// async function seedUsers() {
//   try {
//     console.log('Starting user seeding...');
    
//     // Clear existing users (optional - remove in production)
//     const confirmClear = process.env.CLEAR_EXISTING_USERS === 'true';
//     if (confirmClear) {
//       await User.deleteMany({});
//       console.log('Cleared existing users');
//     }
    
//     const employees = getAllEmployees();
//     const createdUsers = new Map();
    
//     // Default password for all users (already hashed in model)
//     const defaultPassword = process.env.DEFAULT_PASSWORD || 'password123';
    
//     // First pass: Create all users
//     console.log('Creating users...');
//     for (const employee of employees) {
//       try {
//         const userData = {
//           email: employee.email,
//           password: defaultPassword, // Will be hashed by the User model pre-save hook
//           fullName: employee.name,
//           role: employee.role,
//           department: employee.department,
//           departmentRole: employee.departmentRole,
//           hierarchyLevel: getHierarchyLevel(employee.name, employee.department),
//           isActive: true,
//           permissions: []
//         };
        
//         // Check if user already exists
//         const existingUser = await User.findOne({ email: employee.email });
//         if (existingUser) {
//           console.log(`User already exists: ${employee.name} (${employee.email})`);
//           createdUsers.set(employee.name, existingUser);
//           continue;
//         }
        
//         const user = new User(userData);
//         await user.save();
//         createdUsers.set(employee.name, user);
        
//         console.log(`Created user: ${employee.name} - ${employee.role} (${employee.department})`);
//       } catch (error) {
//         console.error(`Error creating user ${employee.name}:`, error.message);
//       }
//     }
    
//     // Second pass: Update supervisor relationships
//     console.log('Updating supervisor relationships...');
//     for (const employee of employees) {
//       try {
//         const user = createdUsers.get(employee.name);
//         if (!user) continue;
        
//         const supervisorId = await findSupervisorId(employee.supervisor, employee.department);
//         const departmentHeadId = await findDepartmentHeadId(employee.department);
        
//         if (supervisorId) {
//           user.supervisor = supervisorId;
//         }
        
//         if (departmentHeadId && departmentHeadId.toString() !== user._id.toString()) {
//           user.departmentHead = departmentHeadId;
//         }
        
//         await user.save();
//         console.log(`Updated relationships for: ${employee.name}`);
//       } catch (error) {
//         console.error(`Error updating relationships for ${employee.name}:`, error.message);
//       }
//     }
    
//     // Third pass: Update direct reports
//     console.log('Updating direct reports...');
//     for (const [userName, user] of createdUsers) {
//       try {
//         const directReports = await User.find({ supervisor: user._id }).select('_id');
//         user.directReports = directReports.map(report => report._id);
//         await user.save();
        
//         if (directReports.length > 0) {
//           console.log(`Updated direct reports for: ${userName} (${directReports.length} reports)`);
//         }
//       } catch (error) {
//         console.error(`Error updating direct reports for ${userName}:`, error.message);
//       }
//     }
    
//     console.log(`Successfully created ${createdUsers.size} employee users`);
//     return createdUsers;
    
//   } catch (error) {
//     console.error('Error seeding users:', error);
//     throw error;
//   }
// }

// // Seed suppliers function
// async function seedSuppliers() {
//   try {
//     console.log('Starting supplier seeding...');
    
//     const defaultPassword = process.env.DEFAULT_SUPPLIER_PASSWORD || 'supplier123';
    
//     for (const supplierData of sampleSuppliers) {
//       try {
//         const existingSupplier = await User.findOne({ email: supplierData.email });
//         if (existingSupplier) {
//           console.log(`Supplier already exists: ${supplierData.supplierDetails.companyName}`);
//           continue;
//         }
        
//         const supplier = new User({
//           ...supplierData,
//           password: defaultPassword, // Will be hashed by the User model pre-save hook
//           isActive: true
//         });
        
//         await supplier.save();
//         console.log(`Created supplier: ${supplierData.supplierDetails.companyName}`);
//       } catch (error) {
//         console.error(`Error creating supplier ${supplierData.supplierDetails.companyName}:`, error.message);
//       }
//     }
    
//     console.log('Supplier seeding completed');
//   } catch (error) {
//     console.error('Error seeding suppliers:', error);
//     throw error;
//   }
// }

// // Create admin user
// async function createAdminUser() {
//   try {
//     console.log('Creating super admin user...');
    
//     const adminEmail = process.env.ADMIN_EMAIL || 'admin@gratoengineering.com';
//     const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
//     const existingAdmin = await User.findOne({ email: adminEmail });
//     if (existingAdmin) {
//       console.log('Super admin already exists');
//       return;
//     }
    
//     const admin = new User({
//       email: adminEmail,
//       password: adminPassword, // Will be hashed by the User model pre-save hook
//       fullName: 'Super Administrator',
//       role: 'admin',
//       department: 'Executive',
//       departmentRole: 'head',
//       hierarchyLevel: 5,
//       isActive: true,
//       permissions: ['all']
//     });
    
//     await admin.save();
//     console.log(`Super admin created: ${adminEmail}`);
//     console.log(`Default password: ${adminPassword}`);
    
//   } catch (error) {
//     console.error('Error creating admin user:', error);
//     throw error;
//   }
// }

// // Print summary
// async function printSummary() {
//   try {
//     console.log('\n=== DATABASE SEEDING SUMMARY ===');
    
//     const userCounts = await User.aggregate([
//       {
//         $group: {
//           _id: '$role',
//           count: { $sum: 1 }
//         }
//       }
//     ]);
    
//     const departmentCounts = await User.aggregate([
//       {
//         $group: {
//           _id: '$department',
//           count: { $sum: 1 }
//         }
//       }
//     ]);
    
//     console.log('\nUsers by Role:');
//     userCounts.forEach(item => {
//       console.log(`- ${item._id}: ${item.count}`);
//     });
    
//     console.log('\nUsers by Department:');
//     departmentCounts.forEach(item => {
//       console.log(`- ${item._id}: ${item.count}`);
//     });
    
//     const totalUsers = await User.countDocuments();
//     console.log(`\nTotal Users Created: ${totalUsers}`);
    
//     console.log('\n=== SEEDING COMPLETED SUCCESSFULLY ===\n');
    
//   } catch (error) {
//     console.error('Error printing summary:', error);
//   }
// }

// // Main seeding function
// async function seedDatabase() {
//   try {
//     await connectToDatabase();
    
//     console.log('🌱 Starting database seeding process...\n');
    
//     // Create super admin first
//     await createAdminUser();
    
//     // Create all employee users
//     await seedUsers();
    
//     // Create sample suppliers
//     await seedSuppliers();
    
//     // Print summary
//     await printSummary();
    
//     console.log('✅ Database seeding completed successfully!');
//     console.log('\n📋 Next steps:');
//     console.log('1. Update default passwords for all users');
//     console.log('2. Configure email verification if required');
//     console.log('3. Set up proper environment variables');
//     console.log('4. Test login functionality with created users');
    
//   } catch (error) {
//     console.error('❌ Database seeding failed:', error);
//   } finally {
//     await mongoose.connection.close();
//     console.log('Database connection closed');
//     process.exit(0);
//   }
// }

// // Run seeding if called directly
// if (require.main === module) {
//   seedDatabase();
// }

// module.exports = {
//   seedDatabase,
//   seedUsers,
//   seedSuppliers,
//   createAdminUser,
//   DEPARTMENT_STRUCTURE,
//   ROLE_MAPPING
// };