const mongoose = require('mongoose');
const User = require('../models/User');
const Supplier = require('../models/Supplier');
require('dotenv').config();

const createAccountsForExistingSuppliers = async () => {
  try {
    console.log('🔐 Creating user accounts for existing suppliers...');

    // Connect to database
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Get all existing suppliers
    const existingSuppliers = await Supplier.find({});
    console.log(`📊 Found ${existingSuppliers.length} existing suppliers:`);
    
    existingSuppliers.forEach(supplier => {
      console.log(`   - ${supplier.name} (${supplier.email}) - Status: ${supplier.status}`);
    });

    const createdAccounts = [];
    const skippedAccounts = [];

    for (const supplier of existingSuppliers) {
      const supplierEmail = supplier.email;
      const defaultPassword = 'supplier123';
      
      // Check if user account already exists
      const existingUser = await User.findOne({ email: supplierEmail });
      
      if (!existingUser) {
        try {
          const contactPersonName = extractContactPersonName(supplier);
          
          // Map supplier categories to supplierType
          const supplierType = mapCategoryToSupplierType(supplier.categories);
          
          // Create supplier user account with required supplierDetails
          const supplierUser = await User.create({
            email: supplierEmail,
            password: defaultPassword, 
            fullName: contactPersonName,
            role: 'supplier',
            department: 'External Suppliers',
            isActive: true,
            phone: supplier.phone || '',
            company: supplier.name,
            
            supplierDetails: {
              companyName: supplier.name,
              contactName: contactPersonName,
              phoneNumber: supplier.phone || '',
              supplierType: supplierType,
              address: {
                street: supplier.address?.street || '',
                city: supplier.address?.city || '',
                state: supplier.address?.state || '',
                country: supplier.address?.country || 'Cameroon',
                postalCode: supplier.address?.postalCode || ''
              },
              businessRegistrationNumber: supplier.registrationNumber || '',
              taxIdNumber: supplier.taxId || '',
              bankDetails: {
                bankName: supplier.bankDetails?.bankName || '',
                accountName: supplier.bankDetails?.accountName || '',
                accountNumber: supplier.bankDetails?.accountNumber || '',
                routingNumber: supplier.bankDetails?.routingNumber || ''
              },
              businessInfo: {
                yearsInBusiness: supplier.yearEstablished ? new Date().getFullYear() - supplier.yearEstablished : 0,
                primaryServices: supplier.services || [],
                certifications: supplier.certifications?.map(cert => cert.name) || [],
                website: supplier.website || ''
              }
            },

            supplierStatus: {
              accountStatus: mapSupplierStatus(supplier.status),
              isVerified: supplier.status === 'approved',
              emailVerified: supplier.status === 'approved',
              approvalDate: supplier.status === 'approved' ? new Date() : undefined
            },

            profile: {
              bio: `Contact person for ${supplier.name}`,
              address: supplier.address,
              phone: supplier.phone,
              website: supplier.website
            }
          });

          createdAccounts.push({
            email: supplierEmail,
            password: defaultPassword,
            name: contactPersonName,
            company: supplier.name,
            supplierId: supplier._id,
            supplierType: supplierType
          });

          console.log(`✅ Created account for: ${contactPersonName} (${supplier.name})`);
          
        } catch (createError) {
          console.log(`❌ Failed to create account for ${supplier.name}: ${createError.message}`);
          skippedAccounts.push({
            company: supplier.name,
            email: supplierEmail,
            reason: createError.message
          });
        }
      } else {
        console.log(`⚠️  Account already exists for: ${supplierEmail} (${supplier.name})`);
        skippedAccounts.push({
          company: supplier.name,
          email: supplierEmail,
          reason: 'Account already exists'
        });
        
        // Update existing user to ensure it's properly configured as supplier
        if (existingUser.role !== 'supplier') {
          existingUser.role = 'supplier';
          existingUser.department = 'External Suppliers';
          existingUser.company = supplier.name;
          
          // Add supplierDetails if missing
          if (!existingUser.supplierDetails || !existingUser.supplierDetails.companyName) {
            const contactPersonName = extractContactPersonName(supplier);
            const supplierType = mapCategoryToSupplierType(supplier.categories);
            
            existingUser.supplierDetails = {
              companyName: supplier.name,
              contactName: contactPersonName,
              phoneNumber: supplier.phone || '',
              supplierType: supplierType,
              address: {
                street: supplier.address?.street || '',
                city: supplier.address?.city || '',
                state: supplier.address?.state || '',
                country: supplier.address?.country || 'Cameroon',
                postalCode: supplier.address?.postalCode || ''
              },
              businessRegistrationNumber: supplier.registrationNumber || '',
              taxIdNumber: supplier.taxId || ''
            };
          }
          
          await existingUser.save();
          console.log(`   ✅ Updated role and supplierDetails for: ${supplierEmail}`);
        }
      }
    }

    console.log(`\n🎉 Account creation process completed!`);
    console.log(`📈 Summary:`);
    console.log(`   - Total suppliers processed: ${existingSuppliers.length}`);
    console.log(`   - New accounts created: ${createdAccounts.length}`);
    console.log(`   - Accounts skipped: ${skippedAccounts.length}`);

    // Display new account credentials
    if (createdAccounts.length > 0) {
      console.log('\n🔑 NEW SUPPLIER LOGIN CREDENTIALS:');
      console.log('=' .repeat(70));
      createdAccounts.forEach((account, index) => {
        console.log(`${index + 1}. ${account.company}`);
        console.log(`   Contact: ${account.name}`);
        console.log(`   Email: ${account.email}`);
        console.log(`   Password: ${account.password}`);
        console.log(`   Role: supplier`);
        console.log(`   Supplier Type: ${account.supplierType}`);
        console.log(`   Supplier ID: ${account.supplierId}`);
        console.log('   ' + '-'.repeat(60));
      });
    }

    // Display skipped accounts
    if (skippedAccounts.length > 0) {
      console.log('\n⚠️  SKIPPED ACCOUNTS:');
      skippedAccounts.forEach((skipped, index) => {
        console.log(`${index + 1}. ${skipped.company} (${skipped.email})`);
        console.log(`   Reason: ${skipped.reason}`);
      });
    }

    // Security reminders
    console.log('\n🔒 SECURITY NOTES:');
    console.log('• All new accounts use the default password: "supplier123"');
    console.log('• Suppliers should change their passwords on first login');
    console.log('• Consider implementing email verification');
    console.log('• Send welcome emails with login instructions');
    
    console.log('\n📧 NEXT STEPS:');
    console.log('1. Test login with the credentials above');
    console.log('2. Send welcome emails to new suppliers');
    console.log('3. Set up password reset functionality');
    console.log('4. Consider implementing two-factor authentication');

    return {
      totalSuppliers: existingSuppliers.length,
      createdAccounts: createdAccounts.length,
      skippedAccounts: skippedAccounts.length,
      accountDetails: createdAccounts
    };

  } catch (error) {
    console.error('❌ Error creating supplier accounts:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('📦 Database connection closed');
  }
};

// Helper function to extract or generate contact person name
function extractContactPersonName(supplier) {
  // Try to extract from existing supplier data
  if (supplier.contactPerson) {
    return supplier.contactPerson;
  }
  
  // Try to get from communications
  if (supplier.communications && supplier.communications.length > 0) {
    const lastComm = supplier.communications[supplier.communications.length - 1];
    if (lastComm.contactPerson) {
      return lastComm.contactPerson;
    }
  }
  
  // Generate a professional contact person name based on company
  const companyName = supplier.name;
  
  // Common professional titles and names for Cameroon
  const titles = ['Mr.', 'Ms.', 'Dr.'];
  const firstNames = [
    'Jean', 'Marie', 'Pierre', 'Amadou', 'Fatou', 'Ibrahim', 'Aisha', 
    'Emmanuel', 'Grace', 'David', 'Sarah', 'Michel', 'Aminata'
  ];
  const lastNames = [
    'Mballa', 'Nguema', 'Fotso', 'Saliou', 'Mvondo', 'Hassan', 
    'Nkomo', 'Essamba', 'Mbeki', 'Tchinda', 'Diallo'
  ];
  
  const randomTitle = titles[Math.floor(Math.random() * titles.length)];
  const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
  const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return `${randomTitle} ${randomFirst} ${randomLast}`;
}

// Helper function to map supplier categories to supplierType enum
function mapCategoryToSupplierType(categories) {
  if (!categories || categories.length === 0) {
    return 'General';
  }
  
  // Define mapping from Supplier categories to User supplierType enum
  const categoryMap = {
    'IT Accessories': 'Supply Chain',
    'Office Supplies': 'HR/Admin', 
    'Equipment': 'Operations',
    'Consumables': 'Operations',
    'Software': 'Operations',
    'Hardware': 'Operations',
    'Furniture': 'HR/Admin',
    'Safety Equipment': 'HSE',
    'Maintenance Supplies': 'Operations',
    'Medical Supplies': 'HSE',
    'Construction Materials': 'Refurbishment'
  };
  
  // Use the first category to determine supplier type
  const primaryCategory = categories[0];
  return categoryMap[primaryCategory] || 'General';
}

// Helper function to map Supplier status to User supplierStatus.accountStatus
function mapSupplierStatus(supplierStatus) {
  const statusMap = {
    'pending': 'pending',
    'approved': 'approved',
    'suspended': 'suspended',
    'rejected': 'rejected',
    'inactive': 'suspended'
  };
  
  return statusMap[supplierStatus] || 'pending';
}

// Function to update supplier passwords
const updateSupplierPassword = async (email, newPassword) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const user = await User.findOne({ email: email, role: 'supplier' });
    if (!user) {
      throw new Error(`Supplier account not found: ${email}`);
    }
    
    user.password = newPassword;
    await user.save();
    
    console.log(`✅ Password updated for: ${user.fullName} (${email})`);
    console.log(`   New password: ${newPassword}`);
    
    return { email, newPassword };
    
  } catch (error) {
    console.error('❌ Password update failed:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
};

// Function to list all supplier accounts
const listSupplierAccounts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const supplierUsers = await User.find({ role: 'supplier' }, 'email fullName company isActive createdAt supplierDetails.companyName supplierDetails.supplierType').sort({ createdAt: -1 });
    
    console.log(`👥 SUPPLIER ACCOUNTS (${supplierUsers.length} total):`);
    console.log('=' .repeat(70));
    
    supplierUsers.forEach((user, index) => {
      const status = user.isActive ? '✅ Active' : '❌ Inactive';
      const supplierType = user.supplierDetails?.supplierType || 'N/A';
      console.log(`${index + 1}. ${user.fullName} (${user.company})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Status: ${status}`);
      console.log(`   Type: ${supplierType}`);
      console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
      console.log('   ' + '-'.repeat(60));
    });
    
    return supplierUsers;
    
  } catch (error) {
    console.error('❌ Error listing accounts:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
};

// Run directly if this file is executed
if (require.main === module) {
  const command = process.argv[2] || 'create';
  
  switch (command) {
    case 'create':
      createAccountsForExistingSuppliers()
        .then((results) => {
          console.log('\n🎯 Process completed successfully!');
          process.exit(0);
        })
        .catch((error) => {
          console.error('💥 Process failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'list':
      listSupplierAccounts()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'password':
      const email = process.argv[3];
      const newPassword = process.argv[4] || 'newSupplier123';
      
      if (!email) {
        console.log('Usage: node script.js password <email> [newPassword]');
        process.exit(1);
      }
      
      updateSupplierPassword(email, newPassword)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    default:
      console.log('Usage: node script.js [create|list|password]');
      console.log('  create    - Create accounts for existing suppliers');
      console.log('  list      - List all supplier accounts');  
      console.log('  password  - Update supplier password');
      process.exit(1);
  }
}

module.exports = {
  createAccountsForExistingSuppliers,
  updateSupplierPassword,
  listSupplierAccounts
};



