require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const QuarterlyKPI = require('../models/QuarterlyKPI');
const fs = require('fs');
const path = require('path');

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

// Get current quarter string
function getCurrentQuarter() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const quarter = Math.ceil(month / 3);
  return `Q${quarter}-${year}`;
}

async function checkKPISubmissions(options = {}) {
  try {
    console.log('📊 KPI SUBMISSION STATUS REPORT');
    console.log('='.repeat(100) + '\n');

    await connectDB();

    const targetQuarter = options.quarter || getCurrentQuarter();
    console.log(`📅 Checking Quarter: ${targetQuarter}\n`);

    // Fetch all active employees (exclude suppliers)
    const employeeQuery = {
      role: { $ne: 'supplier' },
      isActive: true
    };

    if (options.department) {
      employeeQuery.department = options.department;
    }

    const allEmployees = await User.find(employeeQuery)
      .select('_id fullName email department position role hierarchyLevel supervisor')
      .populate('supervisor', 'fullName email')
      .lean()
      .sort({ department: 1, fullName: 1 });

    console.log(`👥 Total Active Employees: ${allEmployees.length}\n`);

    // Fetch all KPIs for the target quarter
    const allKPIs = await QuarterlyKPI.find({ quarter: targetQuarter })
      .populate('employee', 'fullName email department position')
      .lean();

    console.log(`📋 Total KPI Documents for ${targetQuarter}: ${allKPIs.length}\n`);

    // Create a map of employee IDs to their KPI status
    const kpiMap = new Map();
    allKPIs.forEach(kpi => {
      kpiMap.set(kpi.employee._id.toString(), kpi);
    });

    // Categorize employees
    const withKPIs = [];
    const withoutKPIs = [];

    allEmployees.forEach(employee => {
      const employeeId = employee._id.toString();
      const kpi = kpiMap.get(employeeId);

      if (kpi) {
        withKPIs.push({
          employee,
          kpi: {
            _id: kpi._id,
            quarter: kpi.quarter,
            approvalStatus: kpi.approvalStatus,
            totalKPIs: kpi.kpis.length,
            totalWeight: kpi.totalWeight,
            submittedAt: kpi.submittedAt,
            approvedAt: kpi.approvedAt,
            supervisor: kpi.supervisor
          }
        });
      } else {
        withoutKPIs.push({
          employee,
          kpi: null
        });
      }
    });

    // Display summary
    displaySummary(withKPIs, withoutKPIs, targetQuarter);

    // Display detailed breakdown
    if (options.detailed) {
      displayDetailedBreakdown(withKPIs, withoutKPIs);
    }

    // Export to JSON if requested
    if (options.export) {
      exportToJSON({ withKPIs, withoutKPIs, targetQuarter }, options.export);
    }

    // Export to CSV if requested
    if (options.csv) {
      exportToCSV({ withKPIs, withoutKPIs, targetQuarter }, options.csv);
    }

    return { withKPIs, withoutKPIs, allEmployees, targetQuarter };

  } catch (error) {
    console.error('\n❌ Error checking KPI submissions:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

function displaySummary(withKPIs, withoutKPIs, quarter) {
  console.log('📈 SUMMARY');
  console.log('-'.repeat(100));
  
  const total = withKPIs.length + withoutKPIs.length;
  const submissionRate = total > 0 ? ((withKPIs.length / total) * 100).toFixed(1) : 0;

  console.log(`\n📊 Overall Statistics:`);
  console.log(`   Total Employees               : ${total}`);
  console.log(`   Employees with KPIs           : ${withKPIs.length} (${submissionRate}%)`);
  console.log(`   Employees without KPIs        : ${withoutKPIs.length} (${(100 - submissionRate).toFixed(1)}%)`);

  // Breakdown by approval status
  if (withKPIs.length > 0) {
    const byStatus = {};
    withKPIs.forEach(item => {
      const status = item.kpi.approvalStatus;
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    console.log(`\n📋 KPI Approval Status:`);
    Object.entries(byStatus).sort().forEach(([status, count]) => {
      const percentage = ((count / withKPIs.length) * 100).toFixed(1);
      const icon = status === 'approved' ? '✅' : 
                   status === 'pending' ? '⏳' : 
                   status === 'rejected' ? '❌' : '📝';
      console.log(`   ${icon} ${status.padEnd(20)}: ${count} (${percentage}%)`);
    });
  }

  // Breakdown by department
  const deptStats = {};
  
  [...withKPIs, ...withoutKPIs].forEach(item => {
    const dept = item.employee.department || 'No Department';
    if (!deptStats[dept]) {
      deptStats[dept] = { total: 0, submitted: 0, notSubmitted: 0 };
    }
    deptStats[dept].total++;
    if (item.kpi) {
      deptStats[dept].submitted++;
    } else {
      deptStats[dept].notSubmitted++;
    }
  });

  console.log(`\n🏢 By Department:`);
  console.log(`   ${'Department'.padEnd(40)} | ${'Total'.padEnd(6)} | ${'Submitted'.padEnd(10)} | ${'Missing'.padEnd(8)} | Rate`);
  console.log(`   ${'-'.repeat(40)}-+-${'-'.repeat(6)}-+-${'-'.repeat(10)}-+-${'-'.repeat(8)}-+------`);
  
  Object.entries(deptStats)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([dept, stats]) => {
      const rate = stats.total > 0 ? ((stats.submitted / stats.total) * 100).toFixed(1) : 0;
      console.log(`   ${dept.padEnd(40)} | ${String(stats.total).padEnd(6)} | ${String(stats.submitted).padEnd(10)} | ${String(stats.notSubmitted).padEnd(8)} | ${rate}%`);
    });

  console.log('\n' + '='.repeat(100) + '\n');
}

function displayDetailedBreakdown(withKPIs, withoutKPIs) {
  console.log('📋 DETAILED BREAKDOWN');
  console.log('='.repeat(100) + '\n');

  // Employees WITH KPIs
  if (withKPIs.length > 0) {
    console.log(`✅ EMPLOYEES WITH KPIs (${withKPIs.length})`);
    console.log('-'.repeat(100));
    
    // Group by approval status
    const grouped = {};
    withKPIs.forEach(item => {
      const status = item.kpi.approvalStatus;
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push(item);
    });

    Object.entries(grouped).sort().forEach(([status, items]) => {
      console.log(`\n📌 ${status.toUpperCase()} (${items.length})`);
      console.log('-'.repeat(100));
      
      items.forEach((item, idx) => {
        const emp = item.employee;
        const kpi = item.kpi;
        
        console.log(`\n${idx + 1}. ${emp.fullName}`);
        console.log(`   ID               : ${emp._id}`);
        console.log(`   Email            : ${emp.email}`);
        console.log(`   Department       : ${emp.department || 'N/A'}`);
        console.log(`   Position         : ${emp.position || 'N/A'}`);
        console.log(`   KPI Document ID  : ${kpi._id}`);
        console.log(`   Status           : ${kpi.approvalStatus.toUpperCase()}`);
        console.log(`   Total KPIs       : ${kpi.totalKPIs}`);
        console.log(`   Total Weight     : ${kpi.totalWeight}%`);
        
        if (kpi.supervisor) {
          console.log(`   Supervisor       : ${kpi.supervisor.name} (${kpi.supervisor.email})`);
        } else {
          console.log(`   Supervisor       : None (Auto-approved)`);
        }
        
        if (kpi.submittedAt) {
          console.log(`   Submitted        : ${new Date(kpi.submittedAt).toLocaleString()}`);
        }
        
        if (kpi.approvedAt) {
          console.log(`   Approved         : ${new Date(kpi.approvedAt).toLocaleString()}`);
        }
      });
    });
  }

  // Employees WITHOUT KPIs
  if (withoutKPIs.length > 0) {
    console.log(`\n\n❌ EMPLOYEES WITHOUT KPIs (${withoutKPIs.length})`);
    console.log('-'.repeat(100));
    
    // Group by department
    const byDept = {};
    withoutKPIs.forEach(item => {
      const dept = item.employee.department || 'No Department';
      if (!byDept[dept]) byDept[dept] = [];
      byDept[dept].push(item);
    });

    Object.entries(byDept).sort().forEach(([dept, items]) => {
      console.log(`\n📁 ${dept} (${items.length})`);
      console.log('-'.repeat(100));
      
      items.forEach((item, idx) => {
        const emp = item.employee;
        
        console.log(`\n${idx + 1}. ${emp.fullName}`);
        console.log(`   ID               : ${emp._id}`);
        console.log(`   Email            : ${emp.email}`);
        console.log(`   Position         : ${emp.position || 'N/A'}`);
        console.log(`   Role             : ${emp.role}`);
        console.log(`   Hierarchy Level  : ${emp.hierarchyLevel || 1}`);
        
        if (emp.supervisor) {
          console.log(`   Supervisor       : ${emp.supervisor.fullName} (${emp.supervisor.email})`);
        } else {
          console.log(`   Supervisor       : None`);
        }
        
        console.log(`   ⚠️  ACTION REQUIRED : Submit KPIs for current quarter`);
      });
    });
  }

  console.log('\n' + '='.repeat(100) + '\n');
}

function exportToJSON(data, filename = 'kpi_submission_report') {
  try {
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filepath = path.join(exportDir, `${filename}_${timestamp}.json`);

    const exportData = {
      generatedAt: new Date().toISOString(),
      quarter: data.targetQuarter,
      summary: {
        totalEmployees: data.withKPIs.length + data.withoutKPIs.length,
        employeesWithKPIs: data.withKPIs.length,
        employeesWithoutKPIs: data.withoutKPIs.length,
        submissionRate: data.withKPIs.length + data.withoutKPIs.length > 0 
          ? ((data.withKPIs.length / (data.withKPIs.length + data.withoutKPIs.length)) * 100).toFixed(2) + '%'
          : '0%'
      },
      employeesWithKPIs: data.withKPIs.map(item => ({
        employeeId: item.employee._id,
        fullName: item.employee.fullName,
        email: item.employee.email,
        department: item.employee.department,
        position: item.employee.position,
        kpiDocumentId: item.kpi._id,
        approvalStatus: item.kpi.approvalStatus,
        totalKPIs: item.kpi.totalKPIs,
        totalWeight: item.kpi.totalWeight,
        supervisor: item.kpi.supervisor,
        submittedAt: item.kpi.submittedAt,
        approvedAt: item.kpi.approvedAt
      })),
      employeesWithoutKPIs: data.withoutKPIs.map(item => ({
        employeeId: item.employee._id,
        fullName: item.employee.fullName,
        email: item.employee.email,
        department: item.employee.department,
        position: item.employee.position,
        role: item.employee.role,
        hierarchyLevel: item.employee.hierarchyLevel,
        supervisor: item.employee.supervisor ? {
          fullName: item.employee.supervisor.fullName,
          email: item.employee.supervisor.email
        } : null
      }))
    };

    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    console.log(`✅ Exported to JSON: ${filepath}`);
    console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB\n`);
  } catch (error) {
    console.error('❌ Export to JSON failed:', error.message);
  }
}

function exportToCSV(data, filename = 'kpi_submission_report') {
  try {
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filepath = path.join(exportDir, `${filename}_${timestamp}.csv`);

    // CSV headers
    const headers = [
      'Employee ID', 'Full Name', 'Email', 'Department', 'Position', 
      'Has KPIs', 'KPI Document ID', 'Approval Status', 'Total KPIs', 'Total Weight',
      'Submitted At', 'Approved At', 'Supervisor Name', 'Supervisor Email'
    ];

    // Combine both lists
    const allRecords = [
      ...data.withKPIs.map(item => ({
        ...item,
        hasKPIs: 'Yes'
      })),
      ...data.withoutKPIs.map(item => ({
        ...item,
        hasKPIs: 'No'
      }))
    ];

    // Build CSV rows
    const rows = allRecords.map(item => {
      const emp = item.employee;
      const kpi = item.kpi;
      
      return [
        `"${emp._id}"`,
        `"${emp.fullName}"`,
        `"${emp.email}"`,
        `"${emp.department || ''}"`,
        `"${emp.position || ''}"`,
        item.hasKPIs,
        kpi ? `"${kpi._id}"` : '',
        kpi ? `"${kpi.approvalStatus}"` : 'N/A',
        kpi ? kpi.totalKPIs : '',
        kpi ? `${kpi.totalWeight}%` : '',
        kpi?.submittedAt ? new Date(kpi.submittedAt).toISOString() : '',
        kpi?.approvedAt ? new Date(kpi.approvedAt).toISOString() : '',
        kpi?.supervisor ? `"${kpi.supervisor.name}"` : (emp.supervisor ? `"${emp.supervisor.fullName}"` : ''),
        kpi?.supervisor ? `"${kpi.supervisor.email}"` : (emp.supervisor ? `"${emp.supervisor.email}"` : '')
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    fs.writeFileSync(filepath, csv);
    
    console.log(`✅ Exported to CSV: ${filepath}`);
    console.log(`   Rows: ${allRecords.length}`);
    console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB\n`);
  } catch (error) {
    console.error('❌ Export to CSV failed:', error.message);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    detailed: false,
    export: false,
    csv: false,
    quarter: null,
    department: null
  };

  args.forEach(arg => {
    if (arg === '--detailed' || arg === '-d') {
      options.detailed = true;
    } else if (arg === '--export' || arg === '-e') {
      options.export = 'kpi_submission_report';
    } else if (arg === '--csv' || arg === '-c') {
      options.csv = 'kpi_submission_report';
    } else if (arg.startsWith('--quarter=')) {
      options.quarter = arg.split('=')[1];
    } else if (arg.startsWith('--department=')) {
      options.department = arg.split('=')[1];
    }
  });

  return options;
}

// Run the script
if (require.main === module) {
  const options = parseArgs();
  
  console.log('🚀 Starting KPI Submission Check...\n');
  
  checkKPISubmissions(options)
    .then(() => {
      console.log('✅ Done!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { checkKPISubmissions, getCurrentQuarter };