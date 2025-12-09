require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const QuarterlyKPI = require('../models/QuarterlyKPI');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

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

    // Fetch all active employees (exclude suppliers only - NO user exclusions)
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
    const allKPIs = await QuarterlyKPI.find({ 
      quarter: targetQuarter
    })
      .populate('employee', 'fullName email department position')
      .populate('supervisor', 'fullName email')
      .lean();

    console.log(`📋 Total KPI Documents for ${targetQuarter}: ${allKPIs.length}\n`);

    // Create a map of employee IDs to their KPI status
    const kpiMap = new Map();
    allKPIs.forEach(kpi => {
      if (kpi.employee) {
        kpiMap.set(kpi.employee._id.toString(), kpi);
      }
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
            quarter: kpi.quarter || targetQuarter,
            approvalStatus: kpi.approvalStatus || 'draft',
            kpis: kpi.kpis || [],
            totalKPIs: kpi.kpis ? kpi.kpis.length : 0,
            totalWeight: kpi.totalWeight || 0,
            submittedAt: kpi.submittedAt || null,
            approvedAt: kpi.approvedAt || null,
            rejectedAt: kpi.rejectedAt || null,
            rejectionReason: kpi.rejectionReason || null,
            supervisor: kpi.supervisor || null,
            comments: kpi.comments || null
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

    // Generate PDF report
    if (options.pdf) {
      await generatePDFReport({ withKPIs, withoutKPIs, targetQuarter }, options.pdf);
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
      console.log(`   ${status.padEnd(20)}: ${count} (${percentage}%)`);
    });
  }

  console.log('\n' + '='.repeat(100) + '\n');
}

async function generatePDFReport(data, filename = 'kpi_submission_report') {
  return new Promise((resolve, reject) => {
    try {
      // Helper functions
      const safe = (value, defaultValue = 0) => {
        if (value === null || value === undefined) return defaultValue;
        const num = Number(value);
        return isNaN(num) || !isFinite(num) ? defaultValue : num;
      };

      const str = (value, defaultValue = 'N/A') => {
        if (!value) return defaultValue;
        const s = String(value).trim();
        return s || defaultValue;
      };

      const exportDir = path.join(__dirname, '..', 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filepath = path.join(exportDir, `${filename}_${timestamp}.pdf`);

      // Logo path
      const logoPath = path.join(__dirname, '../public/images/company-logo.jpg');
      const hasLogo = fs.existsSync(logoPath);

      // Create PDF document
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        bufferPages: true
      });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Calculate statistics
      const total = safe(data.withKPIs.length + data.withoutKPIs.length);
      const submissionRate = total > 0 ? safe((data.withKPIs.length / total) * 100).toFixed(1) : '0.0';

      // Status breakdown
      const byStatus = {};
      data.withKPIs.forEach(item => {
        const status = item.kpi.approvalStatus;
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      let pageNumber = 1;

      // Safe Y position handler
      const getY = () => {
        const y = safe(doc.y, 115);
        if (y < 50 || y > 750) return 115;
        return y;
      };

      const setY = (value) => {
        doc.y = safe(value, 115);
      };

      // Add watermark
      const addWatermark = () => {
        if (hasLogo) {
          doc.save();
          doc.opacity(0.1);
          try {
            doc.image(logoPath, 197.5, 296, { width: 200 });
          } catch (err) {}
          doc.opacity(1);
          doc.restore();
        }
      };

      // Add footer
      const addFooter = () => {
        try {
          doc.moveTo(50, 742).lineTo(545, 742).strokeColor('#cccccc').stroke();
          doc.fontSize(8).fillColor('#666666')
             .text(`Page ${pageNumber} | Confidential - Internal Use Only`, 50, 752, { align: 'center', width: 495 });
          pageNumber++;
        } catch (err) {
          pageNumber++;
        }
      };

      // Add header
      const addHeader = (pageTitle = '') => {
        try {
          if (hasLogo) {
            try { doc.image(logoPath, 50, 30, { width: 60, height: 60 }); } catch (err) {}
          }
          doc.fontSize(10).fillColor('#333333')
             .text('KPI Management System', 120, 40)
             .fontSize(8).fillColor('#666666')
             .text(`Report Period: ${str(data.targetQuarter)}`, 120, 55)
             .text(`Generated: ${new Date().toLocaleDateString()}`, 120, 67);
          if (pageTitle) {
            doc.fontSize(9).fillColor('#4682b4').text(str(pageTitle), 400, 45, { align: 'right' });
          }
          doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#cccccc').stroke();
          setY(115);
        } catch (err) {
          setY(115);
        }
      };

      // COVER PAGE
      addWatermark();
      if (hasLogo) {
        try { doc.image(logoPath, 216.5, 150, { width: 160, height: 160 }); } catch (err) {}
      }

      doc.y = 350;
      doc.fontSize(28).fillColor('#1a1a1a').font('Helvetica-Bold')
         .text('KPI SUBMISSION', { align: 'center' })
         .text('STATUS REPORT', { align: 'center' })
         .moveDown(2);

      doc.fontSize(18).fillColor('#4682b4').font('Helvetica')
         .text(`Quarter: ${str(data.targetQuarter)}`, { align: 'center' })
         .moveDown(3);

      const boxY = getY();
      doc.roundedRect(100, boxY, 395, 140, 5).fillAndStroke('#f8f9fa', '#dee2e6');
      doc.fillColor('#1a1a1a').fontSize(11).font('Helvetica-Bold')
         .text('Report Summary', 120, boxY + 20);
      doc.font('Helvetica').fontSize(10).moveDown(0.5)
         .text(`Total Employees Reviewed: ${total}`, 120)
         .text(`Submission Rate: ${submissionRate}%`, 120)
         .text(`Employees with Submitted KPIs: ${safe(data.withKPIs.length)}`, 120)
         .text(`Employees Pending Submission: ${safe(data.withoutKPIs.length)}`, 120)
         .moveDown(0.5);
      doc.font('Helvetica-Bold').text('Report Details:', 120).font('Helvetica')
         .text(`Generated: ${new Date().toLocaleString()}`, 120)
         .text(`Status: Official Report`, 120);
      
      setY(680);
    //   doc.fontSize(8).fillColor('#666666')
    //      .text('This report is confidential and intended for internal management use only.', { align: 'center' })
    //      .text('© KPI Management System - All Rights Reserved', { align: 'center' });
      addFooter();

      // DETAILED ANALYSIS - EMPLOYEES WITH KPIs
      if (data.withKPIs.length > 0) {
        doc.addPage();
        addWatermark();
        addHeader('KPI Submissions');
        doc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold')
           .text('Detailed KPI Submission Analysis', 50, 130).moveDown(1);

        doc.fontSize(10).fillColor('#333333').font('Helvetica')
           .text(
             `This section provides detailed information about all employees who have submitted KPIs for ${str(data.targetQuarter)}.`,
             50, getY(), { width: 495 }
           ).moveDown(1.5);

        const grouped = {};
        data.withKPIs.forEach(item => {
          const status = item.kpi.approvalStatus;
          if (!grouped[status]) grouped[status] = [];
          grouped[status].push(item);
        });

        const statusConfig = {
          approved: { color: '#28a745', bgColor: '#d4edda', borderColor: '#c3e6cb', title: 'Approved KPIs' },
          pending: { color: '#856404', bgColor: '#fff3cd', borderColor: '#ffeaa7', title: 'Pending Review' },
          rejected: { color: '#721c24', bgColor: '#f8d7da', borderColor: '#f5c6cb', title: 'Rejected KPIs' },
          draft: { color: '#383d41', bgColor: '#e2e3e5', borderColor: '#d6d8db', title: 'Draft KPIs' }
        };

        ['approved', 'pending', 'rejected', 'draft'].forEach(status => {
          if (!grouped[status] || grouped[status].length === 0) return;

          const config = statusConfig[status];
          const items = grouped[status];

          if (getY() > 700) {
            addFooter();
            doc.addPage();
            addWatermark();
            addHeader('KPI Submissions');
          }

          doc.fontSize(16).font('Helvetica-Bold').fillColor(config.color)
             .text(`${config.title} (${items.length})`, 50).moveDown(0.5);

          items.forEach((item, idx) => {
            if (getY() > 650) {
              addFooter();
              doc.addPage();
              addWatermark();
              addHeader(config.title);
            }

            const emp = item.employee;
            const kpi = item.kpi;
            if (!emp || !emp.fullName) return;

            const boxTop = getY();
            const boxHeight = 120;

            doc.roundedRect(50, boxTop, 495, boxHeight, 5).fillAndStroke(config.bgColor, config.borderColor);
            doc.fontSize(12).fillColor('#1a1a1a').font('Helvetica-Bold')
               .text(`${idx + 1}. ${str(emp.fullName)}`, 65, boxTop + 15);

            doc.roundedRect(450, boxTop + 15, 85, 20, 10).fill(config.color);
            doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
               .text(status.toUpperCase(), 455, boxTop + 19, { width: 75, align: 'center' });

            let detailY = boxTop + 45;
            doc.fontSize(9).fillColor('#495057').font('Helvetica');

            // Email
            doc.font('Helvetica-Bold').text('Email:', 65, detailY);
            doc.font('Helvetica').text(str(emp.email), 115, detailY);
            detailY += 15;

            // Department
            doc.font('Helvetica-Bold').text('Department:', 65, detailY);
            doc.font('Helvetica').text(str(emp.department), 135, detailY);
            detailY += 15;

            // Position
            doc.font('Helvetica-Bold').text('Position:', 65, detailY);
            doc.font('Helvetica').text(str(emp.position), 115, detailY);

            // Right column
            detailY = boxTop + 45;
            doc.font('Helvetica-Bold').text('Total KPIs:', 280, detailY);
            doc.font('Helvetica').text(String(safe(kpi.totalKPIs)), 350, detailY);
            detailY += 15;

            doc.font('Helvetica-Bold').text('Weight:', 280, detailY);
            doc.font('Helvetica').text(`${safe(kpi.totalWeight)}%`, 330, detailY);

            setY(boxTop + boxHeight + 15);
          });

          doc.moveDown(1);
        });
      }

      // EMPLOYEES WITHOUT KPIs
      if (data.withoutKPIs.length > 0) {
        if (getY() > 600) {
          addFooter();
          doc.addPage();
          addWatermark();
          addHeader('Missing Submissions');
        }

        doc.fontSize(16).font('Helvetica-Bold').fillColor('#dc3545')
           .text(`Employees Without KPI Submissions (${data.withoutKPIs.length})`, 50).moveDown(1);

        doc.fontSize(10).fillColor('#721c24').font('Helvetica')
           .text(
             'The following employees have not submitted their KPIs for the current quarter. Immediate action is required.',
             50, getY(), { width: 495 }
           ).moveDown(1);

        // Group by department
        const byDept = {};
        data.withoutKPIs.forEach(item => {
          const dept = item.employee.department || 'No Department';
          if (!byDept[dept]) byDept[dept] = [];
          byDept[dept].push(item);
        });

        Object.entries(byDept).sort().forEach(([dept, items]) => {
          if (getY() > 650) {
            addFooter();
            doc.addPage();
            addWatermark();
            addHeader('Missing Submissions');
          }

          doc.fontSize(13).fillColor('#dc3545').font('Helvetica-Bold')
             .text(`${dept} (${items.length} employees)`, 50).moveDown(0.5);

          items.forEach((item, idx) => {
            if (getY() > 680) {
              addFooter();
              doc.addPage();
              addWatermark();
              addHeader('Missing Submissions');
            }

            const emp = item.employee;
            if (!emp || !emp.fullName) return;

            const boxTop = getY();
            doc.roundedRect(50, boxTop, 495, 85, 5).fillAndStroke('#fff5f5', '#f5c6cb');
            doc.fontSize(20).fillColor('#dc3545').text('!', 65, boxTop + 12);
            doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica-Bold')
               .text(`${idx + 1}. ${str(emp.fullName)}`, 85, boxTop + 12);
            doc.fontSize(8).fillColor('#495057').font('Helvetica')
               .text(`Email: ${str(emp.email)}`, 85, boxTop + 30)
               .text(`Position: ${str(emp.position)}`, 85, boxTop + 43)
               .text(`Role: ${str(emp.role)}`, 85, boxTop + 56);

            doc.roundedRect(400, boxTop + 12, 135, 20, 10).fill('#dc3545');
            doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
               .text('ACTION REQUIRED', 405, boxTop + 16, { width: 125, align: 'center' });

            setY(boxTop + 95);
          });

          doc.moveDown(1);
        });
      }

      addFooter();

      // Finalize
      doc.end();

      stream.on('finish', () => {
        console.log(`\n✅ Professional PDF Report Generated: ${filepath}`);
        console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
        console.log(`   Total pages: ${pageNumber - 1}\n`);
        resolve(filepath);
      });

      stream.on('error', reject);

    } catch (error) {
      console.error('❌ PDF generation failed:', error.message);
      reject(error);
    }
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    pdf: 'kpi_submission_report',
    quarter: null,
    department: null
  };

  args.forEach(arg => {
    if (arg === '--no-pdf') {
      options.pdf = false;
    } else if (arg === '--pdf' || arg === '-p') {
      options.pdf = 'kpi_submission_report';
    } else if (arg.startsWith('--quarter=')) {
      options.quarter = arg.split('=')[1];
    } else if (arg.startsWith('--department=')) {
      options.department = arg.split('=')[1];
    } else if (arg.startsWith('--filename=')) {
      options.pdf = arg.split('=')[1];
    }
  });

  return options;
}

// Run the script
if (require.main === module) {
  const options = parseArgs();
  
  console.log('🚀 Starting KPI PDF Report Generation...\n');
  console.log(`📅 Target Quarter: ${options.quarter || getCurrentQuarter()}`);
  if (options.department) {
    console.log(`🏢 Department Filter: ${options.department}`);
  }
  console.log('');
  
  checkKPISubmissions(options)
    .then(() => {
      console.log('\n✅ Report generation completed successfully!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Report generation failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { checkKPISubmissions, getCurrentQuarter };








// require('dotenv').config();
// const mongoose = require('mongoose');
// const User = require('../models/User');
// const QuarterlyKPI = require('../models/QuarterlyKPI');
// const fs = require('fs');
// const path = require('path');
// const PDFDocument = require('pdfkit');

// const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// // User IDs to exclude from the report
// const EXCLUDED_USER_IDS = [
//   '691abf75c7430e81c19846db',
//   '691abf59c7430e81c19846ab',
//   '691abf61c7430e81c19846b9'
// ];

// async function connectDB() {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log('✅ Connected to MongoDB Atlas\n');
//   } catch (error) {
//     console.error('❌ Connection failed:', error.message);
//     process.exit(1);
//   }
// }

// function getCurrentQuarter() {
//   const now = new Date();
//   const month = now.getMonth() + 1;
//   const year = now.getFullYear();
//   const quarter = Math.ceil(month / 3);
//   return `Q${quarter}-${year}`;
// }

// async function checkKPISubmissions(options = {}) {
//   try {
//     console.log('📊 KPI SUBMISSION STATUS REPORT');
//     console.log('='.repeat(100) + '\n');

//     await connectDB();

//     const targetQuarter = options.quarter || getCurrentQuarter();
//     console.log(`📅 Checking Quarter: ${targetQuarter}\n`);

//     // Fetch all active employees (exclude suppliers and specified users)
//     const employeeQuery = {
//       role: { $ne: 'supplier' },
//       isActive: true,
//       _id: { $nin: EXCLUDED_USER_IDS.map(id => new mongoose.Types.ObjectId(id)) }
//     };

//     if (options.department) {
//       employeeQuery.department = options.department;
//     }

//     const allEmployees = await User.find(employeeQuery)
//       .select('_id fullName email department position role hierarchyLevel supervisor')
//       .populate('supervisor', 'fullName email')
//       .lean()
//       .sort({ department: 1, fullName: 1 });

//     console.log(`👥 Total Active Employees (excluding specified users): ${allEmployees.length}\n`);

//     // Fetch all KPIs for the target quarter (excluding specified users)
//     const allKPIs = await QuarterlyKPI.find({ 
//       quarter: targetQuarter,
//       employee: { $nin: EXCLUDED_USER_IDS.map(id => new mongoose.Types.ObjectId(id)) }
//     })
//       .populate('employee', 'fullName email department position')
//       .populate('supervisor', 'fullName email')
//       .lean();

//     console.log(`📋 Total KPI Documents for ${targetQuarter}: ${allKPIs.length}\n`);

//     // Create a map of employee IDs to their KPI status
//     const kpiMap = new Map();
//     allKPIs.forEach(kpi => {
//       kpiMap.set(kpi.employee._id.toString(), kpi);
//     });

//     // Categorize employees
//     const withKPIs = [];
//     const withoutKPIs = [];

//     allEmployees.forEach(employee => {
//       const employeeId = employee._id.toString();
//       const kpi = kpiMap.get(employeeId);

//       if (kpi) {
//         withKPIs.push({
//           employee,
//           kpi: {
//             _id: kpi._id,
//             quarter: kpi.quarter || targetQuarter,
//             approvalStatus: kpi.approvalStatus || 'draft',
//             kpis: kpi.kpis || [],
//             totalKPIs: kpi.kpis ? kpi.kpis.length : 0,
//             totalWeight: kpi.totalWeight || 0,
//             submittedAt: kpi.submittedAt || null,
//             approvedAt: kpi.approvedAt || null,
//             rejectedAt: kpi.rejectedAt || null,
//             rejectionReason: kpi.rejectionReason || null,
//             supervisor: kpi.supervisor || null,
//             comments: kpi.comments || null
//           }
//         });
//       } else {
//         withoutKPIs.push({
//           employee,
//           kpi: null
//         });
//       }
//     });

//     // Display summary
//     displaySummary(withKPIs, withoutKPIs, targetQuarter);

//     // Generate PDF report
//     if (options.pdf) {
//       await generatePDFReport({ withKPIs, withoutKPIs, targetQuarter }, options.pdf);
//     }

//     return { withKPIs, withoutKPIs, allEmployees, targetQuarter };

//   } catch (error) {
//     console.error('\n❌ Error checking KPI submissions:', error);
//     console.error(error.stack);
//     process.exit(1);
//   }
// }

// function displaySummary(withKPIs, withoutKPIs, quarter) {
//   console.log('📈 SUMMARY');
//   console.log('-'.repeat(100));
  
//   const total = withKPIs.length + withoutKPIs.length;
//   const submissionRate = total > 0 ? ((withKPIs.length / total) * 100).toFixed(1) : 0;

//   console.log(`\n📊 Overall Statistics:`);
//   console.log(`   Total Employees               : ${total}`);
//   console.log(`   Employees with KPIs           : ${withKPIs.length} (${submissionRate}%)`);
//   console.log(`   Employees without KPIs        : ${withoutKPIs.length} (${(100 - submissionRate).toFixed(1)}%)`);

//   // Breakdown by approval status
//   if (withKPIs.length > 0) {
//     const byStatus = {};
//     withKPIs.forEach(item => {
//       const status = item.kpi.approvalStatus;
//       byStatus[status] = (byStatus[status] || 0) + 1;
//     });

//     console.log(`\n📋 KPI Approval Status:`);
//     Object.entries(byStatus).sort().forEach(([status, count]) => {
//       const percentage = ((count / withKPIs.length) * 100).toFixed(1);
//       console.log(`   ${status.padEnd(20)}: ${count} (${percentage}%)`);
//     });
//   }

//   console.log('\n' + '='.repeat(100) + '\n');
// }

// async function generatePDFReport(data, filename = 'kpi_submission_report') {
//   return new Promise((resolve, reject) => {
//     try {
//       // Helper functions
//       const safe = (value, defaultValue = 0) => {
//         if (value === null || value === undefined) return defaultValue;
//         const num = Number(value);
//         return isNaN(num) || !isFinite(num) ? defaultValue : num;
//       };

//       const str = (value, defaultValue = 'N/A') => {
//         if (!value) return defaultValue;
//         const s = String(value).trim();
//         return s || defaultValue;
//       };

//       const exportDir = path.join(__dirname, '..', 'exports');
//       if (!fs.existsSync(exportDir)) {
//         fs.mkdirSync(exportDir, { recursive: true });
//       }

//       const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
//       const filepath = path.join(exportDir, `${filename}_${timestamp}.pdf`);

//       // Logo path
//       const logoPath = path.join(__dirname, '../public/images/company-logo.jpg');
//       const hasLogo = fs.existsSync(logoPath);

//       // Create PDF document
//       const doc = new PDFDocument({ 
//         size: 'A4', 
//         margin: 50,
//         bufferPages: true
//       });
//       const stream = fs.createWriteStream(filepath);
//       doc.pipe(stream);

//       // Calculate statistics
//       const total = safe(data.withKPIs.length + data.withoutKPIs.length);
//       const submissionRate = total > 0 ? safe((data.withKPIs.length / total) * 100).toFixed(1) : '0.0';

//       // Status breakdown
//       const byStatus = {};
//       data.withKPIs.forEach(item => {
//         const status = item.kpi.approvalStatus;
//         byStatus[status] = (byStatus[status] || 0) + 1;
//       });

//       // Department breakdown
//       const deptStats = {};
//       [...data.withKPIs, ...data.withoutKPIs].forEach(item => {
//         const dept = item.employee.department || 'No Department';
//         if (!deptStats[dept]) {
//           deptStats[dept] = { total: 0, submitted: 0, notSubmitted: 0, approved: 0, pending: 0, rejected: 0 };
//         }
//         deptStats[dept].total++;
//         if (item.kpi) {
//           deptStats[dept].submitted++;
//           if (item.kpi.approvalStatus === 'approved') deptStats[dept].approved++;
//           else if (item.kpi.approvalStatus === 'pending') deptStats[dept].pending++;
//           else if (item.kpi.approvalStatus === 'rejected') deptStats[dept].rejected++;
//         } else {
//           deptStats[dept].notSubmitted++;
//         }
//       });

//       let pageNumber = 1;

//       // Safe Y position handler
//       const getY = () => {
//         const y = safe(doc.y, 115);
//         if (y < 50 || y > 750) return 115;
//         return y;
//       };

//       const setY = (value) => {
//         doc.y = safe(value, 115);
//       };

//       // Add watermark
//       const addWatermark = () => {
//         if (hasLogo) {
//           doc.save();
//           doc.opacity(0.1);
//           try {
//             doc.image(logoPath, 197.5, 296, { width: 200 });
//           } catch (err) {}
//           doc.opacity(1);
//           doc.restore();
//         }
//       };

//       // Add footer
//       const addFooter = () => {
//         try {
//           doc.moveTo(50, 742).lineTo(545, 742).strokeColor('#cccccc').stroke();
//           doc.fontSize(8).fillColor('#666666')
//              .text(`Page ${pageNumber} | Confidential - Internal Use Only`, 50, 752, { align: 'center', width: 495 });
//           pageNumber++;
//         } catch (err) {
//           pageNumber++;
//         }
//       };

//       // Add header
//       const addHeader = (pageTitle = '') => {
//         try {
//           if (hasLogo) {
//             try { doc.image(logoPath, 50, 30, { width: 60, height: 60 }); } catch (err) {}
//           }
//           doc.fontSize(10).fillColor('#333333')
//              .text('KPI Management System', 120, 40)
//              .fontSize(8).fillColor('#666666')
//              .text(`Report Period: ${str(data.targetQuarter)}`, 120, 55)
//              .text(`Generated: ${new Date().toLocaleDateString()}`, 120, 67);
//           if (pageTitle) {
//             doc.fontSize(9).fillColor('#4682b4').text(str(pageTitle), 400, 45, { align: 'right' });
//           }
//           doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#cccccc').stroke();
//           setY(115);
//         } catch (err) {
//           setY(115);
//         }
//       };

//       // COVER PAGE
//       addWatermark();
//       if (hasLogo) {
//         try { doc.image(logoPath, 216.5, 150, { width: 160, height: 160 }); } catch (err) {}
//       }

//       doc.y = 350;
//       doc.fontSize(28).fillColor('#1a1a1a').font('Helvetica-Bold')
//          .text('KPI SUBMISSION', { align: 'center' })
//          .text('STATUS REPORT', { align: 'center' })
//          .moveDown(2);

//       doc.fontSize(18).fillColor('#4682b4').font('Helvetica')
//          .text(`Quarter: ${str(data.targetQuarter)}`, { align: 'center' })
//          .moveDown(3);

//       const boxY = getY();
//       doc.roundedRect(100, boxY, 395, 180, 5).fillAndStroke('#f8f9fa', '#dee2e6');
//       doc.fillColor('#1a1a1a').fontSize(11).font('Helvetica-Bold')
//          .text('Report Summary', 120, boxY + 20);
//       doc.font('Helvetica').fontSize(10).moveDown(0.5)
//          .text(`Total Employees Reviewed: ${total}`, 120)
//          .text(`Submission Rate: ${submissionRate}%`, 120)
//          .text(`Employees with Submitted KPIs: ${safe(data.withKPIs.length)}`, 120)
//          .text(`Employees Pending Submission: ${safe(data.withoutKPIs.length)}`, 120)
//          .moveDown(0.5);
//       doc.font('Helvetica-Bold').text('Report Details:', 120).font('Helvetica')
//          .text(`Generated: ${new Date().toLocaleString()}`, 120)
//          .text(`Departments Covered: ${safe(Object.keys(deptStats).length)}`, 120)
//          .text(`Status: Official Report`, 120);
      
//       setY(680);
//       doc.fontSize(8).fillColor('#666666')
//          .text('This report is confidential and intended for internal management use only.', { align: 'center' })
//          .text('© KPI Management System - All Rights Reserved', { align: 'center' });
//       addFooter();

//       // TABLE OF CONTENTS
//       doc.addPage();
//       addWatermark();
//       addHeader('Table of Contents');
//       doc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold')
//          .text('Table of Contents', 50, 130).moveDown(1.5);

//       const tocItems = [
//         'Executive Summary', 'Department Performance Overview',
//         'Detailed KPI Submission Analysis', 'Recommendations and Action Items'
//       ];
//       doc.font('Helvetica').fontSize(11).fillColor('#333333');
//       tocItems.forEach((item, idx) => {
//         doc.text(`${idx + 1}. ${item}`, 70);
//         doc.moveDown(0.7);
//       });
//       addFooter();

//       // EXECUTIVE SUMMARY
//       doc.addPage();
//       addWatermark();
//       addHeader('Executive Summary');
//       doc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold')
//          .text('Executive Summary', 50, 130).moveDown(1);
//       doc.fontSize(11).font('Helvetica').fillColor('#333333')
//          .text(
//            `This report provides a comprehensive analysis of KPI submission status for ${str(data.targetQuarter)}. `,
//            50, getY(), { align: 'justify', width: 495 }
//          ).moveDown(1.5);

//       // Key Metrics
//       doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a')
//          .text('Key Performance Indicators', 50).moveDown(0.5);

//       const metrics = [
//         { label: 'Total Employees', value: total, color: '#4682b4' },
//         { label: 'Submission Rate', value: `${submissionRate}%`, color: '#28a745' },
//         { label: 'Submitted KPIs', value: data.withKPIs.length, color: '#28a745' },
//         { label: 'Pending Submission', value: data.withoutKPIs.length, color: '#dc3545' }
//       ];

//       let metricX = 50;
//       const metricY = getY();
//       metrics.forEach(metric => {
//         doc.roundedRect(metricX, metricY, 115, 80, 5).fillAndStroke('#ffffff', '#dee2e6');
//         doc.fontSize(20).font('Helvetica-Bold').fillColor(metric.color)
//            .text(String(metric.value), metricX + 10, metricY + 25, { width: 95, align: 'center' });
//         doc.fontSize(9).font('Helvetica').fillColor('#666666')
//            .text(metric.label, metricX + 10, metricY + 55, { width: 95, align: 'center' });
//         metricX += 123;
//       });

//       setY(metricY + 100);

//       // Status Breakdown
//       if (Object.keys(byStatus).length > 0) {
//         doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a')
//            .text('KPI Approval Status Breakdown', 50).moveDown(0.5);

//         const statusColors = {
//           approved: '#28a745', pending: '#ffc107',
//           rejected: '#dc3545', draft: '#6c757d'
//         };

//         Object.entries(byStatus).forEach(([status, count]) => {
//           const color = statusColors[status] || '#6c757d';
//           const percentage = ((count / data.withKPIs.length) * 100).toFixed(1);
//           const barWidth = (parseFloat(percentage) / 100) * 400;
//           const barY = getY();

//           doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold')
//              .text(`${status.toUpperCase()}`, 50, barY + 5);
//           doc.roundedRect(180, barY, 365, 25, 3).fillAndStroke('#f8f9fa', '#dee2e6');
//           if (barWidth > 0) {
//             doc.roundedRect(180, barY, barWidth, 25, 3).fill(color);
//           }
//           doc.fontSize(10).fillColor('#1a1a1a').font('Helvetica-Bold')
//              .text(`${count} (${percentage}%)`, 190, barY + 7);
//           setY(barY + 35);
//         });
//       }
//       addFooter();

//       // DEPARTMENT PERFORMANCE
//       doc.addPage();
//       addWatermark();
//       addHeader('Department Performance');
//       doc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold')
//          .text('Department Performance Overview', 50, 130).moveDown(1.5);

//       const tableTop = getY();
//       const colWidths = [140, 50, 60, 60, 60, 65, 60];
//       const cols = ['Department', 'Total', 'Submit', 'Approve', 'Pending', 'Reject', 'Rate'];

//       doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
//       doc.roundedRect(50, tableTop, 495, 22, 3).fill('#4682b4');
      
//       let xPos = 50;
//       cols.forEach((col, i) => {
//         doc.text(col, xPos + 8, tableTop + 6, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'center' });
//         xPos += colWidths[i];
//       });

//       doc.fillColor('#1a1a1a').font('Helvetica');
//       let yPos = tableTop + 25;

//       Object.entries(deptStats).sort((a, b) => b[1].total - a[1].total).forEach(([dept, stats], index) => {
//         if (yPos > 700) {
//           addFooter();
//           doc.addPage();
//           addWatermark();
//           addHeader('Department Performance');
//           yPos = 130;
//         }

//         const rate = stats.total > 0 ? safe((stats.submitted / stats.total) * 100).toFixed(1) : '0.0';
//         const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
        
//         doc.roundedRect(50, yPos, 495, 22, 2).fill(bgColor);
//         doc.fillColor('#1a1a1a');

//         xPos = 50;
//         const rowData = [
//           str(dept, 'Unknown'), safe(stats.total), safe(stats.submitted),
//           safe(stats.approved), safe(stats.pending), safe(stats.rejected), `${rate}%`
//         ];
        
//         rowData.forEach((data, i) => {
//           const textColor = i === 6 
//             ? (parseFloat(rate) >= 80 ? '#28a745' : parseFloat(rate) >= 60 ? '#ffc107' : '#dc3545')
//             : '#1a1a1a';
//           doc.fillColor(textColor).fontSize(9)
//              .text(String(data), xPos + 8, yPos + 6, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'center' });
//           xPos += colWidths[i];
//         });
//         yPos += 25;
//       });
//       addFooter();

//       // DETAILED ANALYSIS
//       if (data.withKPIs.length > 0) {
//         doc.addPage();
//         addWatermark();
//         addHeader('Detailed Analysis');
//         doc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold')
//            .text('Detailed KPI Submission Analysis', 50, 130).moveDown(1.5);

//         const grouped = {};
//         data.withKPIs.forEach(item => {
//           const status = item.kpi.approvalStatus;
//           if (!grouped[status]) grouped[status] = [];
//           grouped[status].push(item);
//         });

//         const statusConfig = {
//           approved: { color: '#28a745', bgColor: '#d4edda', borderColor: '#c3e6cb', title: 'Approved KPIs' },
//           pending: { color: '#856404', bgColor: '#fff3cd', borderColor: '#ffeaa7', title: 'Pending Review' },
//           rejected: { color: '#721c24', bgColor: '#f8d7da', borderColor: '#f5c6cb', title: 'Rejected KPIs' },
//           draft: { color: '#383d41', bgColor: '#e2e3e5', borderColor: '#d6d8db', title: 'Draft KPIs' }
//         };

//         ['approved', 'pending', 'rejected', 'draft'].forEach(status => {
//           if (!grouped[status] || grouped[status].length === 0) return;

//           const config = statusConfig[status];
//           const items = grouped[status];

//           if (getY() > 700) {
//             addFooter();
//             doc.addPage();
//             addWatermark();
//             addHeader('Detailed Analysis');
//           }

//           doc.fontSize(16).font('Helvetica-Bold').fillColor(config.color)
//              .text(`${config.title} (${items.length})`, 50).moveDown(0.5);

//           items.forEach((item, idx) => {
//             if (getY() > 650) {
//               addFooter();
//               doc.addPage();
//               addWatermark();
//               addHeader(config.title);
//             }

//             const emp = item.employee;
//             const kpi = item.kpi;
//             if (!emp || !emp.fullName) return;

//             const boxTop = getY();
//             const boxHeight = 120;

//             doc.roundedRect(50, boxTop, 495, boxHeight, 5).fillAndStroke(config.bgColor, config.borderColor);
//             doc.fontSize(12).fillColor('#1a1a1a').font('Helvetica-Bold')
//                .text(`${idx + 1}. ${str(emp.fullName)}`, 65, boxTop + 15);

//             doc.roundedRect(450, boxTop + 15, 85, 20, 10).fill(config.color);
//             doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
//                .text(status.toUpperCase(), 455, boxTop + 19, { width: 75, align: 'center' });

//             let detailY = boxTop + 45;
//             doc.fontSize(9).fillColor('#495057').font('Helvetica');

//             // Email
//             doc.font('Helvetica-Bold').text('Email:', 65, detailY);
//             doc.font('Helvetica').text(str(emp.email), 115, detailY);
//             detailY += 15;

//             // Department
//             doc.font('Helvetica-Bold').text('Department:', 65, detailY);
//             doc.font('Helvetica').text(str(emp.department), 135, detailY);
//             detailY += 15;

//             // Position
//             doc.font('Helvetica-Bold').text('Position:', 65, detailY);
//             doc.font('Helvetica').text(str(emp.position), 115, detailY);

//             // Right column
//             detailY = boxTop + 45;
//             doc.font('Helvetica-Bold').text('Total KPIs:', 280, detailY);
//             doc.font('Helvetica').text(String(safe(kpi.totalKPIs)), 350, detailY);
//             detailY += 15;

//             doc.font('Helvetica-Bold').text('Weight:', 280, detailY);
//             doc.font('Helvetica').text(`${safe(kpi.totalWeight)}%`, 330, detailY);

//             setY(boxTop + boxHeight + 15);
//           });

//           doc.moveDown(1);
//         });
//       }

//       // EMPLOYEES WITHOUT KPIs
//       if (data.withoutKPIs.length > 0) {
//         if (getY() > 600) {
//           addFooter();
//           doc.addPage();
//           addWatermark();
//           addHeader('Missing Submissions');
//         }

//         doc.fontSize(16).font('Helvetica-Bold').fillColor('#dc3545')
//            .text(`⚠ Employees Without KPI Submissions (${data.withoutKPIs.length})`, 50).moveDown(1);

//         const byDept = {};
//         data.withoutKPIs.forEach(item => {
//           const dept = item.employee.department || 'No Department';
//           if (!byDept[dept]) byDept[dept] = [];
//           byDept[dept].push(item);
//         });

//         Object.entries(byDept).sort().forEach(([dept, items]) => {
//           if (getY() > 650) {
//             addFooter();
//             doc.addPage();
//             addWatermark();
//             addHeader('Missing Submissions');
//           }

//           doc.fontSize(13).fillColor('#dc3545').font('Helvetica-Bold')
//              .text(`📁 ${dept} (${items.length} employees)`, 50).moveDown(0.5);

//           items.forEach((item, idx) => {
//             if (getY() > 680) {
//               addFooter();
//               doc.addPage();
//               addWatermark();
//               addHeader('Missing Submissions');
//             }

//             const emp = item.employee;
//             if (!emp || !emp.fullName) return;

//             const boxTop = getY();
//             doc.roundedRect(50, boxTop, 495, 85, 5).fillAndStroke('#fff5f5', '#f5c6cb');
//             doc.fontSize(20).fillColor('#dc3545').text('⚠', 60, boxTop + 10);
//             doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica-Bold')
//                .text(`${idx + 1}. ${str(emp.fullName)}`, 85, boxTop + 12);
//             doc.fontSize(8).fillColor('#495057').font('Helvetica')
//                .text(`Email: ${str(emp.email)}`, 85, boxTop + 30)
//                .text(`Position: ${str(emp.position)}`, 85, boxTop + 43)
//                .text(`Role: ${str(emp.role)}`, 85, boxTop + 56);

//             doc.roundedRect(400, boxTop + 12, 135, 20, 10).fill('#dc3545');
//             doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
//                .text('ACTION REQUIRED', 405, boxTop + 16, { width: 125, align: 'center' });

//             setY(boxTop + 95);
//           });

//           doc.moveDown(1);
//         });
//       }

//       // RECOMMENDATIONS
//       addFooter();
//       doc.addPage();
//       addWatermark();
//       addHeader('Recommendations');
//       doc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold')
//          .text('Recommendations & Action Items', 50, 130).moveDown(1.5);

//       const recommendations = [
//         {
//           priority: 'HIGH', color: '#dc3545', title: 'Immediate Follow-up Required',
//           items: [
//             `${safe(data.withoutKPIs.length)} employees have not submitted KPIs`,
//             'Schedule one-on-one meetings with non-compliant employees',
//             'Escalate repeated non-compliance to department heads'
//           ]
//         },
//         {
//           priority: 'MEDIUM', color: '#ffc107', title: 'Review and Approval Process',
//           items: [
//             `${safe(byStatus.pending, 0)} KPIs pending review`,
//             'Provide feedback on rejected KPIs within 48 hours',
//             'Ensure supervisors are trained on KPI evaluation criteria'
//           ]
//         }
//       ];

//       recommendations.forEach(rec => {
//         if (getY() > 600) {
//           addFooter();
//           doc.addPage();
//           addWatermark();
//           addHeader('Recommendations');
//         }

//         const boxTop = getY();
//         doc.roundedRect(50, boxTop, 495, 20, 5).fill(rec.color);
//         doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
//            .text(`${rec.priority} PRIORITY: ${rec.title}`, 60, boxTop + 6);
//         setY(boxTop + 30);

//         rec.items.forEach((item, itemIdx) => {
//           doc.fontSize(10).fillColor('#333333').font('Helvetica')
//              .text(`${itemIdx + 1}. ${str(item)}`, 65, getY(), { width: 470, align: 'justify' })
//              .moveDown(0.5);
//         });
//         doc.moveDown(1);
//       });

//       addFooter();

//       // Finalize
//       doc.end();

//       stream.on('finish', () => {
//         console.log(`✅ Professional PDF Report Generated: ${filepath}`);
//         console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
//         console.log(`   Total pages: ${pageNumber - 1}\n`);
//         resolve(filepath);
//       });

//       stream.on('error', reject);

//     } catch (error) {
//       console.error('❌ PDF generation failed:', error.message);
//       reject(error);
//     }
//   });
// }

// function parseArgs() {
//   const args = process.argv.slice(2);
//   const options = {
//     pdf: 'kpi_submission_report',
//     quarter: null,
//     department: null
//   };

//   args.forEach(arg => {
//     if (arg === '--no-pdf') {
//       options.pdf = false;
//     } else if (arg === '--pdf' || arg === '-p') {
//       options.pdf = 'kpi_submission_report';
//     } else if (arg.startsWith('--quarter=')) {
//       options.quarter = arg.split('=')[1];
//     } else if (arg.startsWith('--department=')) {
//       options.department = arg.split('=')[1];
//     } else if (arg.startsWith('--filename=')) {
//       options.pdf = arg.split('=')[1];
//     }
//   });

//   return options;
// }

// // Run the script
// if (require.main === module) {
//   const options = parseArgs();
  
//   console.log('🚀 Starting Professional KPI PDF Report Generation...\n');
//   console.log(`📌 Excluding ${EXCLUDED_USER_IDS.length} specified users from report`);
//   console.log(`📅 Target Quarter: ${options.quarter || getCurrentQuarter()}`);
//   if (options.department) {
//     console.log(`🏢 Department Filter: ${options.department}`);
//   }
//   console.log('');
  
//   checkKPISubmissions(options)
//     .then(() => {
//       console.log('\n✅ Report generation completed successfully!\n');
//       process.exit(0);
//     })
//     .catch(error => {
//       console.error('\n❌ Report generation failed:', error.message);
//       console.error(error.stack);
//       process.exit(1);
//     });
// }

// module.exports = { checkKPISubmissions, getCurrentQuarter };