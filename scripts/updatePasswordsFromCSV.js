// scripts/updatePasswordsFromCSV.js - Update all user passwords from CSV data
require('dotenv').config();
const mongoose = require('mongoose');
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

// CSV Data with passwords
const CSV_PASSWORD_DATA = `Full Name,Email,Password,Role,Department,Position
System Administrator,admin@gratoengineering.com,Admin_Exec_2847!,admin,Executive,N/A
Mr. E.T Kelvin,kelvin.eyong@gratoglobal.com,Kelvin_Busi_7392#,admin,Business Development & Supply Chain,President / Head of Business
Mr. Lukong Lambert,lukong.lambert@gratoglobal.com,Lambert_Busi_4821@,supply_chain,Business Development & Supply Chain,Supply Chain Coordinator
Ms. Ranibell Mambo,ranibellmambo@gratoengineering.com,Mambo_Busi_9156$,finance,Business Development & Supply Chain,Finance Officer
Ms. Christabel Mangwi,christabel@gratoengineering.com,Mangwi_Busi_5738!,project,Business Development & Supply Chain,Order Management Assistant/Buyer
Ms. Aghangu Marie,aghangu.marie@gratoengineering.com,Marie_Busi_3294&,employee,Business Development & Supply Chain,Warehouse Assistant
Mrs. Bruiline Tsitoh,bruiline.tsitoh@gratoglobal.com,Tsitoh_HR_8512@,hr,HR & Admin,HR & Admin Head
Carmel Dafny,carmel.dafny@gratoglobal.com,Dafny_HR_6347#,employee,HR & Admin,Receptionist
Marcel,marcel.ngong@gratoglobal.com,Marcel_HR_4629$,it,HR & Admin,IT Staff
Mr. Che Earnest,che.earnest@gratoengineering.com,Earnest_HR_7183!,employee,HR & Admin,Office Driver/Logistics Assistant
Ms. Ndi Belther,ndi.belther@gratoengineering.com,Belther_HR_9425&,employee,HR & Admin,House Maid
Mr. Didier Oyong,didier.oyong@gratoengineering.com,Oyong_Tech_5746@,technical,Technical,Technical Director
Mr. Joel Wamba,joel@gratoengineering.com,Wamba_Tech_3981#,technical,Technical,Project Manager
Mr. Kevin Minka,minka.kevin@gratoglobal.com,Minka_Tech_8235$,employee,Technical,Diesel Coordinator
Mr. Ovo Bechem,bechem.mbu@gratoglobal.com,Bechem_Tech_4672!,hse,Technical,HSE Coordinator
Mr. Pascal Assam,pascal.rodrique@gratoglobal.com,Assam_Tech_9148&,technical,Technical,Operations Manager
Mr. Yerla Ivo,verla.ivo@gratoengineering.com,Ivo_Tech_6523@,employee,Technical,Head of Refurbishment
Felix Tientcheu,felix.tientcheu@gratoglobal.com,Tientcheu_Tech_2857#,technical,Technical,Site Supervisor
Joseph TAYOU,joseph.tayou@gratoglobal.com,TAYOU_Tech_7394$,technical,Technical,Site Supervisor
Mr. Bemba Essack,bemba.essack@gratoglobal.com,Essack_Tech_5186!,employee,Technical,Data Collector
Mr. Rodrigue Nono,rodrigue.nono@gratoglobal.com,Nono_Tech_8729&,technical,Technical,NOC Coordinator
Danick Djiyap,djiyap.danick@gratoglobal.com,Djiyap_Tech_4361@,employee,Technical,Field Technician
Djackba Marcel,djackba.marcel@gratoglobal.com,Marcel_Tech_9572#,employee,Technical,Field Technician
Kenfack Jacques,kenfack.jacques@gratoglobal.com,Jacques_Tech_6218$,employee,Technical,Field Technician
Paul EM Nyomb,paul.nyomb@gratoglobal.com,Nyomb_Tech_3845!,employee,Technical,Field Technician
EDIDIE François,dedidie.francois@gratoglobal.com,François_Tech_7129&,employee,Technical,Field Technician
Boris Kamgang,kamgang.junior@gratoglobal.com,Kamgang_Tech_5493@,employee,Technical,Field Technician
Sunday,sunday@gratoglobal.com,Sunday_Tech_8761#,employee,Technical,Field Technician
Urich MOUMI,ulrich.vitrand@gratoglobal.com,MOUMI_Tech_2647$,employee,Technical,Field Technician
Abeeb,abeeb@gratoglobal.com,Abeeb_Tech_9284!,employee,Technical,Field Technician
Berthin DEFFO,mba.berthin@gratoglobal.com,DEFFO_Tech_4156&,employee,Technical,Field Technician
Allassane,allassane@gratoglobal.com,Allassane_Tech_7532@,employee,Technical,Field Technician
Alioum Moussa,alioum.moussa@gratoglobal.com,Moussa_Tech_6918#,employee,Technical,Field Technician
Junior Mukudi,junior.mukudi@gratoglobal.com,Mukudi_Tech_3274$,employee,Technical,NOC Operator
Wilfried Kamegni,kamegni.wilfried@gratoglobal.com,Kamegni_Tech_8495!,employee,Technical,NOC Operator
Yves Yossa,yossa.yves@gratoglobal.com,Yossa_Tech_5637&,employee,Technical,NOC Operator
Ervine Mbezele,ervine.mbezele@gratoglobal.com,Mbezele_Tech_9182@,employee,Technical,NOC Operator
Mr. Pryde Mua,pryde.mua@gratoglobal.com,Mua_Supp_4763#,buyer,supply_chain,Warehouse Coordinator/Buyer`;

// Parse CSV data
function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  const headers = lines[0].split(',');
  
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim();
    });
    
    data.push(row);
  }
  
  return data;
}

async function updatePasswordsFromCSV() {
  try {
    console.log('🔐 UPDATING USER PASSWORDS FROM CSV DATA');
    console.log('='.repeat(80) + '\n');

    await connectDB();

    // Parse CSV data
    const passwordData = parseCSV(CSV_PASSWORD_DATA);
    
    console.log(`📊 Found ${passwordData.length} users in CSV data\n`);

    let successCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    const notFoundUsers = [];
    const updatedUsers = [];

    console.log('📝 Updating passwords...\n');

    // Update each user
    for (const row of passwordData) {
      const email = row.Email;
      const password = row.Password;
      const fullName = row['Full Name'];

      if (!email || !password) {
        console.log(`⚠️  Skipping row: Missing email or password`);
        continue;
      }

      try {
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
          notFoundCount++;
          notFoundUsers.push({ fullName, email });
          console.log(`⚠️  User not found: ${fullName} (${email})`);
          continue;
        }

        // Update password (will be hashed by pre-save hook)
        user.password = password;
        await user.save();

        successCount++;
        updatedUsers.push({
          fullName: user.fullName,
          email: user.email,
          password: password,
          department: user.department,
          role: user.role
        });

        console.log(`✅ Updated: ${user.fullName.padEnd(30)} → ${password}`);

      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating ${email}:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log(`Total users in CSV     : ${passwordData.length}`);
    console.log(`Successfully updated   : ${successCount} ✅`);
    console.log(`Users not found        : ${notFoundCount} ⚠️`);
    console.log(`Errors                 : ${errorCount} ❌`);

    if (notFoundUsers.length > 0) {
      console.log('\n⚠️  USERS NOT FOUND IN DATABASE:');
      console.log('-'.repeat(80));
      notFoundUsers.forEach(user => {
        console.log(`   ${user.fullName.padEnd(30)} - ${user.email}`);
      });
      console.log('\n💡 These users need to be created first.');
      console.log('   Run: node scripts/seedCompleteUsers.js --force\n');
    }

    if (successCount > 0) {
      console.log('\n✅ PASSWORD UPDATE COMPLETE!\n');
      
      // Display by department
      displayByDepartment(updatedUsers);

      console.log('\n' + '='.repeat(80));
      console.log('📋 NEXT STEPS:');
      console.log('='.repeat(80));
      console.log('1. ✅ All passwords have been updated and hashed in the database');
      console.log('2. 📧 Distribute passwords to users through secure channels');
      console.log('3. 🔒 Instruct users to change their password on first login');
      console.log('4. 🗑️  Delete all password documents after distribution');
      console.log('5. ✔️  Verify users can login successfully\n');

      // Verify sample passwords
      await verifySamplePasswords(updatedUsers.slice(0, 5));
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Update failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

function displayByDepartment(users) {
  console.log('\n📁 UPDATED PASSWORDS BY DEPARTMENT');
  console.log('='.repeat(80) + '\n');

  // Group by department
  const byDept = {};
  users.forEach(user => {
    const dept = user.department || 'Unknown';
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(user);
  });

  // Display each department
  Object.entries(byDept).sort().forEach(([dept, deptUsers]) => {
    console.log(`\n${dept.toUpperCase()} (${deptUsers.length} users)`);
    console.log('-'.repeat(80));
    
    deptUsers.forEach(user => {
      console.log(`   ${user.fullName.padEnd(30)} | ${user.email.padEnd(40)} | ${user.password}`);
    });
  });
}

async function verifySamplePasswords(sampleUsers) {
  if (sampleUsers.length === 0) return;

  console.log('\n🔍 VERIFYING PASSWORDS (Sample of 5 users)');
  console.log('='.repeat(80) + '\n');

  for (const userData of sampleUsers) {
    try {
      const user = await User.findOne({ email: userData.email });
      if (user) {
        const isValid = await user.comparePassword(userData.password);
        const status = isValid ? '✅ VERIFIED' : '❌ FAILED';
        console.log(`${status} - ${user.fullName} (${userData.email})`);
      }
    } catch (error) {
      console.log(`❌ ERROR - ${userData.fullName}: ${error.message}`);
    }
  }

  console.log('\n');
}

async function showCSVData() {
  console.log('📋 CSV PASSWORD DATA');
  console.log('='.repeat(80) + '\n');

  const passwordData = parseCSV(CSV_PASSWORD_DATA);

  console.log(`Total Records: ${passwordData.length}\n`);

  // Group by department
  const byDept = {};
  passwordData.forEach(row => {
    const dept = row.Department || 'Unknown';
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(row);
  });

  Object.entries(byDept).sort().forEach(([dept, users]) => {
    console.log(`\n📁 ${dept.toUpperCase()} (${users.length} users)`);
    console.log('-'.repeat(80));
    
    users.forEach(user => {
      console.log(`   ${user['Full Name'].padEnd(30)} | ${user.Email.padEnd(40)} | ${user.Password}`);
    });
  });

  console.log('\n' + '='.repeat(80) + '\n');
  process.exit(0);
}

async function exportToFile() {
  try {
    const fs = require('fs');
    const path = require('path');

    const exportDir = path.join(__dirname, '..', 'secure_exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true, mode: 0o700 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    // Export original CSV
    const csvPath = path.join(exportDir, `user_passwords_${timestamp}.csv`);
    fs.writeFileSync(csvPath, CSV_PASSWORD_DATA, { mode: 0o600 });
    console.log(`✅ Exported CSV to: ${csvPath}`);

    // Export as JSON
    const passwordData = parseCSV(CSV_PASSWORD_DATA);
    const jsonPath = path.join(exportDir, `user_passwords_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(passwordData, null, 2), { mode: 0o600 });
    console.log(`✅ Exported JSON to: ${jsonPath}`);

    // Export formatted text
    const txtPath = path.join(exportDir, `user_passwords_${timestamp}.txt`);
    let content = '═'.repeat(90) + '\n';
    content += '                    GRATO GLOBAL USER CREDENTIALS\n';
    content += '═'.repeat(90) + '\n';
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `Total Users: ${passwordData.length}\n`;
    content += '═'.repeat(90) + '\n\n';

    const byDept = {};
    passwordData.forEach(row => {
      const dept = row.Department || 'Unknown';
      if (!byDept[dept]) byDept[dept] = [];
      byDept[dept].push(row);
    });

    Object.entries(byDept).sort().forEach(([dept, users]) => {
      content += `\n${'▼'.repeat(45)}\n`;
      content += `DEPARTMENT: ${dept.toUpperCase()}\n`;
      content += `${'▼'.repeat(45)}\n\n`;

      users.forEach((user, idx) => {
        content += `${idx + 1}. ${user['Full Name']}\n`;
        content += `   Email    : ${user.Email}\n`;
        content += `   Password : ${user.Password}\n`;
        content += `   Role     : ${user.Role}\n`;
        content += `   Position : ${user.Position}\n\n`;
      });
    });

    content += '\n' + '═'.repeat(90) + '\n';
    content += '⚠️  CONFIDENTIAL - DELETE AFTER SECURE DISTRIBUTION\n';
    content += '═'.repeat(90) + '\n';

    fs.writeFileSync(txtPath, content, { mode: 0o600 });
    console.log(`✅ Exported TXT to: ${txtPath}\n`);

    // Create .gitignore
    const gitignorePath = path.join(exportDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
      console.log(`🔒 Created .gitignore to protect password files\n`);
    }

  } catch (error) {
    console.error('❌ Export failed:', error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (require.main === module) {
  switch (command) {
    case 'update':
    case '--update':
    case '-u':
      updatePasswordsFromCSV();
      break;

    case 'show':
    case '--show':
    case '-s':
      showCSVData();
      break;

    case 'export':
    case '--export':
    case '-e':
      exportToFile().then(() => process.exit(0));
      break;

    default:
      console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║          UPDATE USER PASSWORDS FROM CSV - GRATO GLOBAL ERP                ║
╚═══════════════════════════════════════════════════════════════════════════╝

This script updates all user passwords from the embedded CSV data.

Usage:
  node scripts/updatePasswordsFromCSV.js [command]

Commands:
  update, -u       Update all user passwords from CSV data
  show, -s         Display the CSV data without updating
  export, -e       Export CSV data to files (CSV, JSON, TXT)

Examples:
  # Update all passwords (RECOMMENDED)
  node scripts/updatePasswordsFromCSV.js update

  # Preview CSV data first
  node scripts/updatePasswordsFromCSV.js show

  # Export to files for distribution
  node scripts/updatePasswordsFromCSV.js export

CSV Data:
  ✅ Contains ${parseCSV(CSV_PASSWORD_DATA).length} user records with passwords
  ✅ All passwords are in format: Name_Dept_####[Special]
  ✅ Passwords will be automatically hashed when stored

Features:
  ✅ Parses embedded CSV data
  ✅ Updates passwords in database (auto-hashed)
  ✅ Verifies sample passwords after update
  ✅ Shows detailed summary by department
  ✅ Identifies users not found in database
  ✅ Can export to multiple formats

Security:
  🔒 Passwords are hashed using bcrypt before storage
  🔒 Original passwords only visible in this script
  🔒 Export files have restricted permissions (0600)
  🔒 .gitignore automatically created in export folder

Next Steps After Running:
  1. Verify all users were updated successfully
  2. Export credentials: node scripts/updatePasswordsFromCSV.js export
  3. Distribute passwords securely to users
  4. Instruct users to change passwords on first login
  5. Delete all password files after distribution
      `);
      process.exit(0);
  }
}

module.exports = { 
  updatePasswordsFromCSV,
  parseCSV,
  CSV_PASSWORD_DATA
};