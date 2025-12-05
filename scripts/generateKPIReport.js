require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const QuarterlyKPI = require('../models/QuarterlyKPI');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// User IDs to exclude from the report
const EXCLUDED_USER_IDS = [
  '691abf75c7430e81c19846db',
  '691abf59c7430e81c19846ab',
  '691abf61c7430e81c19846b9'
];

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

    // Fetch all active employees (exclude suppliers and specified users)
    const employeeQuery = {
      role: { $ne: 'supplier' },
      isActive: true,
      _id: { $nin: EXCLUDED_USER_IDS.map(id => new mongoose.Types.ObjectId(id)) }
    };

    if (options.department) {
      employeeQuery.department = options.department;
    }

    const allEmployees = await User.find(employeeQuery)
      .select('_id fullName email department position role hierarchyLevel supervisor')
      .populate('supervisor', 'fullName email')
      .lean()
      .sort({ department: 1, fullName: 1 });

    console.log(`👥 Total Active Employees (excluding specified users): ${allEmployees.length}\n`);

    // Fetch all KPIs for the target quarter (excluding specified users)
    const allKPIs = await QuarterlyKPI.find({ 
      quarter: targetQuarter,
      employee: { $nin: EXCLUDED_USER_IDS.map(id => new mongoose.Types.ObjectId(id)) }
    })
      .populate('employee', 'fullName email department position')
      .populate('supervisor', 'fullName email')
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
      await generatePDFReport({ withKPIs, withoutKPIs, allEmployees, targetQuarter }, options.pdf);
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
      // ============ CRITICAL: Enhanced validation helpers ============
      const safeNumber = (value, defaultValue = 0) => {
        if (value === null || value === undefined) return defaultValue;
        const num = Number(value);
        if (isNaN(num) || !isFinite(num)) return defaultValue;
        return num;
      };

      const safeString = (value, defaultValue = 'N/A') => {
        if (value === null || value === undefined) return defaultValue;
        const str = String(value).trim();
        return str || defaultValue;
      };

      // ============ Safe Y position management ============
      const safeY = (doc, newY) => {
        if (newY !== undefined) {
          const validY = safeNumber(newY, 115);
          if (validY < 50 || validY > 800) {
            doc.y = 115;
            return 115;
          }
          doc.y = validY;
          return validY;
        }
        
        const currentY = safeNumber(doc.y, 115);
        if (currentY < 50 || currentY > 800) {
          doc.y = 115;
          return 115;
        }
        return currentY;
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
        bufferPages: true,
        info: {
          Title: `KPI Submission Report - ${data.targetQuarter}`,
          Author: 'KPI Management System',
          Subject: `Quarterly KPI Status Report for ${data.targetQuarter}`,
          Keywords: 'KPI, Performance, Report, Quarterly'
        }
      });
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Initialize doc.y safely
      safeY(doc, 115);

      // Calculate statistics
      const total = safeNumber(data.withKPIs.length + data.withoutKPIs.length, 0);
      const submissionRate = total > 0 ? safeNumber((data.withKPIs.length / total) * 100).toFixed(1) : '0.0';

      // Status breakdown
      const byStatus = {};
      data.withKPIs.forEach(item => {
        const status = item.kpi.approvalStatus;
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      // Department breakdown
      const deptStats = {};
      [...data.withKPIs, ...data.withoutKPIs].forEach(item => {
        const dept = item.employee.department || 'No Department';
        if (!deptStats[dept]) {
          deptStats[dept] = { total: 0, submitted: 0, notSubmitted: 0, approved: 0, pending: 0, rejected: 0 };
        }
        deptStats[dept].total++;
        if (item.kpi) {
          deptStats[dept].submitted++;
          if (item.kpi.approvalStatus === 'approved') deptStats[dept].approved++;
          else if (item.kpi.approvalStatus === 'pending') deptStats[dept].pending++;
          else if (item.kpi.approvalStatus === 'rejected') deptStats[dept].rejected++;
        } else {
          deptStats[dept].notSubmitted++;
        }
      });

      let pageNumber = 1;

      // Helper function to add watermark
      function addWatermark() {
        if (hasLogo) {
          doc.save();
          doc.opacity(0.1);
          try {
            const centerX = safeNumber(doc.page.width / 2 - 100, 197.5);
            const centerY = safeNumber(doc.page.height / 2 - 100, 296);
            doc.image(logoPath, centerX, centerY, { width: 200 });
          } catch (err) {
            console.log('Could not add watermark:', err.message);
          }
          doc.opacity(1);
          doc.restore();
        }
      }

      // Helper function to add header
      function addHeader(pageTitle = '') {
        try {
          if (hasLogo && fs.existsSync(logoPath)) {
            try {
              doc.image(logoPath, 50, 30, { width: 60, height: 60 });
            } catch (err) {
              console.log('Could not add logo:', err.message);
            }
          }
          
          doc.fontSize(10)
             .fillColor('#333333')
             .text('KPI Management System', 120, 40, { align: 'left' })
             .fontSize(8)
             .fillColor('#666666')
             .text(`Report Period: ${safeString(data.targetQuarter)}`, 120, 55)
             .text(`Generated: ${new Date().toLocaleDateString()}`, 120, 67);

          if (pageTitle) {
            doc.fontSize(9)
               .fillColor('#4682b4')
               .text(safeString(pageTitle), 400, 45, { align: 'right' });
          }

          doc.moveTo(50, 100)
             .lineTo(545, 100)
             .strokeColor('#cccccc')
             .stroke();

          safeY(doc, 115);
        } catch (err) {
          console.error('Error adding header:', err.message);
          safeY(doc, 115);
        }
      }

      // Helper function to add footer
      function addFooter() {
        try {
          const footerY = safeNumber(doc.page.height - 50, 742);
          
          doc.moveTo(50, footerY)
             .lineTo(545, footerY)
             .strokeColor('#cccccc')
             .stroke();

          doc.fontSize(8)
             .fillColor('#666666')
             .text(
               `Page ${pageNumber} | Confidential - Internal Use Only`,
               50,
               footerY + 10,
               { align: 'center', width: 495 }
             );
          
          pageNumber++;
        } catch (err) {
          console.error('Error adding footer:', err.message);
          pageNumber++;
        }
      }

      // ==================== COVER PAGE ====================
      try {
        addWatermark();
        
        if (hasLogo && fs.existsSync(logoPath)) {
          try {
            const logoX = safeNumber(doc.page.width / 2 - 80, 216.5);
            doc.image(logoPath, logoX, 150, { width: 160, height: 160 });
          } catch (err) {
            console.log('Could not add cover logo:', err.message);
          }
        }

        doc.moveDown(12);

        doc.fontSize(28)
           .fillColor('#1a1a1a')
           .font('Helvetica-Bold')
           .text('KPI SUBMISSION', { align: 'center' })
           .fontSize(28)
           .text('STATUS REPORT', { align: 'center' })
           .moveDown(2);

        doc.fontSize(18)
           .fillColor('#4682b4')
           .font('Helvetica')
           .text(`Quarter: ${safeString(data.targetQuarter)}`, { align: 'center' })
           .moveDown(3);

        const boxY = safeNumber(safeY(doc), 400);
        doc.roundedRect(100, boxY, 395, 180, 5)
           .fillAndStroke('#f8f9fa', '#dee2e6');

        doc.fillColor('#1a1a1a')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('Report Summary', 120, boxY + 20)
           .moveDown(0.8);

        doc.font('Helvetica')
           .fontSize(10)
           .text(`Total Employees Reviewed: ${total}`, 120)
           .text(`Submission Rate: ${submissionRate}%`, 120)
           .text(`Employees with Submitted KPIs: ${safeNumber(data.withKPIs.length)}`, 120)
           .text(`Employees Pending Submission: ${safeNumber(data.withoutKPIs.length)}`, 120)
           .moveDown(0.8);

        doc.font('Helvetica-Bold')
           .text('Report Details:', 120)
           .font('Helvetica')
           .text(`Generated: ${new Date().toLocaleString()}`, 120)
           .text(`Departments Covered: ${safeNumber(Object.keys(deptStats).length)}`, 120)
           .text(`Status: Official Report`, 120);

        doc.moveDown(4);

        doc.fontSize(8)
           .fillColor('#666666')
           .text('This report is confidential and intended for internal management use only.', { align: 'center' })
           .text('© KPI Management System - All Rights Reserved', { align: 'center' });

        addFooter();
      } catch (err) {
        console.error('Error creating cover page:', err.message);
        throw err;
      }

      // ==================== TABLE OF CONTENTS ====================
      doc.addPage();
      addWatermark();
      addHeader('Table of Contents');

      doc.fontSize(20)
         .fillColor('#1a1a1a')
         .font('Helvetica-Bold')
         .text('Table of Contents', 50, 130)
         .moveDown(1.5);

      const tocItems = [
        { title: 'Executive Summary', page: 3 },
        { title: 'Department Performance Overview', page: 4 },
        { title: 'Detailed KPI Submission Analysis', page: 5 },
        { title: 'Employees with Approved KPIs', page: 6 },
        { title: 'Employees with Pending KPIs', page: '7+' },
        { title: 'Employees with Rejected KPIs', page: '7+' },
        { title: 'Employees Without KPI Submissions', page: '8+' },
        { title: 'Recommendations and Action Items', page: 'Final' }
      ];

      doc.font('Helvetica')
         .fontSize(11)
         .fillColor('#333333');

      tocItems.forEach(item => {
        const yPos = safeY(doc);
        doc.text(item.title, 70, yPos, { continued: true, width: 400 })
           .text(`...........................................`, { continued: true })
           .fillColor('#4682b4')
           .text(` ${item.page}`, { align: 'right' });
        doc.fillColor('#333333');
        doc.moveDown(0.7);
      });

      addFooter();

      // ==================== EXECUTIVE SUMMARY ====================
      doc.addPage();
      addWatermark();
      addHeader('Executive Summary');

      doc.fontSize(20)
         .fillColor('#1a1a1a')
         .font('Helvetica-Bold')
         .text('Executive Summary', 50, 130)
         .moveDown(1);

      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#333333')
         .text(
           `This report provides a comprehensive analysis of KPI submission status for ${data.targetQuarter}. ` +
           `The data reflects the performance management activities across all departments and identifies ` +
           `areas requiring immediate attention.`,
           50,
           { align: 'justify', width: 495 }
         )
         .moveDown(1.5);

      // Key Metrics Grid
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('Key Performance Indicators', 50)
         .moveDown(0.5);

      const metrics = [
        { label: 'Total Employees', value: total, color: '#4682b4', icon: '👥' },
        { label: 'Submission Rate', value: `${submissionRate}%`, color: submissionRate >= 80 ? '#28a745' : submissionRate >= 60 ? '#ffc107' : '#dc3545', icon: '📊' },
        { label: 'Submitted KPIs', value: data.withKPIs.length, color: '#28a745', icon: '✓' },
        { label: 'Pending Submission', value: data.withoutKPIs.length, color: '#dc3545', icon: '⚠' }
      ];

      let metricX = 50;
      const metricStartY = safeY(doc);
      
      metrics.forEach((metric, idx) => {
        const boxX = metricX;
        const boxY = metricStartY;

        doc.roundedRect(boxX, boxY, 115, 80, 5)
           .fillAndStroke('#ffffff', '#dee2e6');

        doc.fontSize(24)
           .fillColor(metric.color)
           .text(metric.icon, boxX + 10, boxY + 15, { width: 95, align: 'center' });

        doc.fontSize(20)
           .font('Helvetica-Bold')
           .fillColor(metric.color)
           .text(String(metric.value), boxX + 10, boxY + 45, { width: 95, align: 'center' });

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#666666')
           .text(metric.label, boxX + 10, boxY + 68, { width: 95, align: 'center' });

        metricX += 123;
      });

      safeY(doc, metricStartY + 100);

      // Status Breakdown
      if (Object.keys(byStatus).length > 0) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#1a1a1a')
           .text('KPI Approval Status Breakdown', 50)
           .moveDown(0.5);

        const statusConfig = {
          approved: { color: '#28a745', icon: '✓', label: 'Approved' },
          pending: { color: '#ffc107', icon: '⏳', label: 'Pending Review' },
          rejected: { color: '#dc3545', icon: '✗', label: 'Rejected' },
          draft: { color: '#6c757d', icon: '📝', label: 'Draft' }
        };

        Object.entries(byStatus).forEach(([status, count]) => {
          const config = statusConfig[status] || { color: '#6c757d', icon: '•', label: status };
          const percentage = ((count / data.withKPIs.length) * 100).toFixed(1);
          const barWidth = (percentage / 100) * 400;

          const barY = safeY(doc);

          doc.fontSize(10)
             .fillColor('#333333')
             .font('Helvetica-Bold')
             .text(`${config.icon} ${config.label}`, 50, barY + 5);

          doc.roundedRect(180, barY, 365, 25, 3)
             .fillAndStroke('#f8f9fa', '#dee2e6');

          if (barWidth > 0) {
            doc.roundedRect(180, barY, barWidth, 25, 3)
               .fill(config.color);
          }

          doc.fontSize(10)
             .fillColor('#1a1a1a')
             .font('Helvetica-Bold')
             .text(`${count} (${percentage}%)`, 190, barY + 7);

          safeY(doc, barY + 35);
        });
      }

      addFooter();

      // ==================== DEPARTMENT PERFORMANCE ====================
      doc.addPage();
      addWatermark();
      addHeader('Department Performance');

      doc.fontSize(20)
         .fillColor('#1a1a1a')
         .font('Helvetica-Bold')
         .text('Department Performance Overview', 50, 130)
         .moveDown(1.5);

      let tableTop = safeNumber(safeY(doc), 200);
      const colWidths = [140, 50, 60, 60, 60, 65, 60];
      const cols = ['Department', 'Total', 'Submit', 'Approve', 'Pending', 'Reject', 'Rate'];

      // Table header
      doc.fontSize(9)
         .fillColor('#ffffff')
         .font('Helvetica-Bold');
      
      doc.roundedRect(50, tableTop, 495, 22, 3).fill('#4682b4');
      
      let xPos = 50;
      cols.forEach((col, i) => {
        doc.text(safeString(col), xPos + 8, tableTop + 6, { 
          width: colWidths[i] - 10, 
          align: i === 0 ? 'left' : 'center' 
        });
        xPos += colWidths[i];
      });

      doc.fillColor('#1a1a1a');
      doc.font('Helvetica');
      
      let yPos = safeNumber(tableTop + 25, tableTop + 25);

      Object.entries(deptStats)
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([dept, stats], index) => {
          const currentY = safeNumber(yPos, 130);
          if (currentY > 700) {
            addFooter();
            doc.addPage();
            addWatermark();
            addHeader('Department Performance');
            yPos = 130;
          }

          const rate = stats.total > 0 ? safeNumber((stats.submitted / stats.total) * 100).toFixed(1) : '0.0';
          const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
          
          const safeYPos = safeNumber(yPos, 130);
          doc.roundedRect(50, safeYPos, 495, 22, 2).fill(bgColor);
          doc.fillColor('#1a1a1a');

          xPos = 50;
          const rowData = [
            safeString(dept, 'Unknown'),
            safeNumber(stats.total),
            safeNumber(stats.submitted),
            safeNumber(stats.approved),
            safeNumber(stats.pending),
            safeNumber(stats.rejected),
            `${rate}%`
          ];
          
          rowData.forEach((data, i) => {
            const textColor = i === 6 ? (parseFloat(rate) >= 80 ? '#28a745' : parseFloat(rate) >= 60 ? '#ffc107' : '#dc3545') : '#1a1a1a';
            doc.fillColor(textColor)
               .fontSize(9)
               .text(safeString(String(data)), xPos + 8, safeYPos + 6, { 
                 width: colWidths[i] - 10, 
                 align: i === 0 ? 'left' : 'center' 
               });
            xPos += colWidths[i];
          });

          yPos = safeNumber(safeYPos + 25, safeYPos + 25);
        });

      safeY(doc, safeNumber(yPos + 10, yPos + 10));

      addFooter();

      // ==================== DETAILED KPI ANALYSIS ====================
      doc.addPage();
      addWatermark();
      addHeader('Detailed Analysis');

      doc.fontSize(20)
         .fillColor('#1a1a1a')
         .font('Helvetica-Bold')
         .text('Detailed KPI Submission Analysis', 50, 130)
         .moveDown(1.5);

      // Group by status
      if (data.withKPIs.length > 0) {
        const grouped = {};
        data.withKPIs.forEach(item => {
          const status = item.kpi.approvalStatus;
          if (!grouped[status]) grouped[status] = [];
          grouped[status].push(item);
        });

        const statusOrder = ['approved', 'pending', 'rejected', 'draft'];
        const statusConfig = {
          approved: { color: '#28a745', bgColor: '#d4edda', borderColor: '#c3e6cb', icon: '✓', title: 'Approved KPIs' },
          pending: { color: '#856404', bgColor: '#fff3cd', borderColor: '#ffeaa7', icon: '⏳', title: 'Pending Review' },
          rejected: { color: '#721c24', bgColor: '#f8d7da', borderColor: '#f5c6cb', icon: '✗', title: 'Rejected KPIs' },
          draft: { color: '#383d41', bgColor: '#e2e3e5', borderColor: '#d6d8db', icon: '📝', title: 'Draft KPIs' }
        };

        statusOrder.forEach(status => {
          if (!grouped[status] || grouped[status].length === 0) return;

          const config = statusConfig[status];
          const items = grouped[status];

          const currentY = safeY(doc);
          if (currentY > 700) {
            addFooter();
            doc.addPage();
            addWatermark();
            addHeader('Detailed Analysis');
          }

          doc.fontSize(16)
             .font('Helvetica-Bold')
             .fillColor(config.color)
             .text(`${config.icon} ${config.title} (${items.length})`, 50)
             .moveDown(0.5);

          items.forEach((item, idx) => {
            const checkY = safeY(doc);
            if (checkY > 650) {
              addFooter();
              doc.addPage();
              addWatermark();
              addHeader(config.title);
            }

            const emp = item.employee;
            const kpi = item.kpi;

            if (!emp || !emp.fullName) {
              console.log(`Warning: Skipping invalid employee data at index ${idx}`);
              return;
            }

            const boxTop = safeY(doc);
            const boxHeight = status === 'rejected' ? 160 : 140;

            doc.roundedRect(50, boxTop, 495, boxHeight, 5)
               .fillAndStroke(config.bgColor, config.borderColor);

            doc.fontSize(12)
               .fillColor('#1a1a1a')
               .font('Helvetica-Bold')
               .text(`${idx + 1}. ${emp.fullName}`, 65, boxTop + 15);

            doc.roundedRect(450, boxTop + 15, 85, 20, 10)
               .fill(config.color);
            
            doc.fontSize(9)
               .fillColor('#ffffff')
               .font('Helvetica-Bold')
               .text(status.toUpperCase(), 455, boxTop + 19, { width: 75, align: 'center' });

            const col1X = 65;
            const col2X = 280;
            let detailY = boxTop + 45;

            doc.fontSize(9)
               .fillColor('#495057')
               .font('Helvetica');

            doc.font('Helvetica-Bold').text('Email:', col1X, detailY, { continued: true, width: 50 })
               .font('Helvetica').text(` ${emp.email || 'N/A'}`, { width: 200 });
            detailY += 15;

            doc.font('Helvetica-Bold').text('Department:', col1X, detailY, { continued: true, width: 70 })
               .font('Helvetica').text(` ${emp.department || 'N/A'}`, { width: 180 });
            detailY += 15;

            doc.font('Helvetica-Bold').text('Position:', col1X, detailY, { continued: true, width: 50 })
               .font('Helvetica').text(` ${emp.position || 'N/A'}`, { width: 200 });

            detailY = boxTop + 45;
            doc.font('Helvetica-Bold').text('Total KPIs:', col2X, detailY, { continued: true, width: 60 })
               .font('Helvetica').text(` ${kpi.totalKPIs || 0}`, { width: 100 });
            detailY += 15;

            doc.font('Helvetica-Bold').text('Weight:', col2X, detailY, { continued: true, width: 60 })
               .font('Helvetica').text(` ${kpi.totalWeight || 0}%`, { width: 100 });
            detailY += 15;

            if (kpi.supervisor) {
              doc.font('Helvetica-Bold').text('Supervisor:', col2X, detailY, { continued: true, width: 70 })
                 .font('Helvetica').text(` ${kpi.supervisor.fullName || kpi.supervisor.name || 'N/A'}`, { width: 180 });
            }

            detailY = boxTop + 95;
            doc.fontSize(8)
               .fillColor('#6c757d');

            if (kpi.submittedAt) {
              doc.text(`📅 Submitted: ${new Date(kpi.submittedAt).toLocaleString()}`, col1X, detailY);
            }

            if (kpi.approvedAt) {
              doc.text(`✓ Approved: ${new Date(kpi.approvedAt).toLocaleString()}`, col2X, detailY);
            } else if (kpi.rejectedAt) {
              doc.text(`✗ Rejected: ${new Date(kpi.rejectedAt).toLocaleString()}`, col2X, detailY);
            }

            if (status === 'rejected' && kpi.rejectionReason) {
              detailY += 15;
              doc.fontSize(8)
                 .fillColor('#721c24')
                 .font('Helvetica-Bold')
                 .text('Rejection Reason:', col1X, detailY)
                 .font('Helvetica')
                 .text(kpi.rejectionReason, col1X, detailY + 12, { width: 470 });
            }

            safeY(doc, boxTop + boxHeight + 15);
          });

          doc.moveDown(1);
        });
      }

      // ==================== EMPLOYEES WITHOUT KPIs ====================
      if (data.withoutKPIs.length > 0) {
        const checkY = safeY(doc);
        if (checkY > 600) {
          addFooter();
          doc.addPage();
          addWatermark();
          addHeader('Missing Submissions');
        }

        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor('#dc3545')
           .text(`⚠ Employees Without KPI Submissions (${data.withoutKPIs.length})`, 50)
           .moveDown(1);

        doc.fontSize(10)
           .fillColor('#721c24')
           .font('Helvetica')
           .text(
             'The following employees have not submitted their KPIs for the current quarter. ' +
             'Immediate action is required to ensure compliance with performance management protocols.',
             50,
             { align: 'justify', width: 495 }
           )
           .moveDown(1);

        const byDept = {};
        data.withoutKPIs.forEach(item => {
          const dept = item.employee.department || 'No Department';
          if (!byDept[dept]) byDept[dept] = [];
          byDept[dept].push(item);
        });

        Object.entries(byDept).sort().forEach(([dept, items]) => {
          const checkDeptY = safeY(doc);
          if (checkDeptY > 650) {
            addFooter();
            doc.addPage();
            addWatermark();
            addHeader('Missing Submissions');
          }

          doc.fontSize(13)
             .fillColor('#dc3545')
             .font('Helvetica-Bold')
             .text(`📁 ${dept} (${items.length} employees)`, 50)
             .moveDown(0.5);

          items.forEach((item, idx) => {
            const checkItemY = safeY(doc);
            if (checkItemY > 680) {
              addFooter();
              doc.addPage();
              addWatermark();
              addHeader('Missing Submissions');
            }

            const emp = item.employee;
            
            if (!emp || !emp.fullName) {
              console.log(`Warning: Skipping invalid employee data at index ${idx}`);
              return;
            }

            const boxTop = safeY(doc);

            doc.roundedRect(50, boxTop, 495, 85, 5)
               .fillAndStroke('#fff5f5', '#f5c6cb');

            doc.fontSize(20)
               .fillColor('#dc3545')
               .text('⚠', 60, boxTop + 10);

            doc.fontSize(11)
               .fillColor('#1a1a1a')
               .font('Helvetica-Bold')
               .text(`${idx + 1}. ${emp.fullName}`, 85, boxTop + 12);

            doc.fontSize(8)
               .fillColor('#495057')
               .font('Helvetica')
               .text(`Email: ${emp.email || 'N/A'}`, 85, boxTop + 30)
               .text(`Position: ${emp.position || 'N/A'}`, 85, boxTop + 43)
               .text(`Role: ${emp.role || 'N/A'}`, 85, boxTop + 56);

            if (emp.supervisor) {
              doc.text(`Supervisor: ${emp.supervisor.fullName || 'N/A'}`, 280, boxTop + 30);
            }

            doc.roundedRect(400, boxTop + 12, 135, 20, 10)
               .fill('#dc3545');
            
            doc.fontSize(8)
               .fillColor('#ffffff')
               .font('Helvetica-Bold')
               .text('ACTION REQUIRED', 405, boxTop + 16, { width: 125, align: 'center' });

            safeY(doc, boxTop + 95);
          });

          doc.moveDown(1);
        });
      }

      // ==================== RECOMMENDATIONS ====================
      addFooter();
      doc.addPage();
      addWatermark();
      addHeader('Recommendations');

      doc.fontSize(20)
         .fillColor('#1a1a1a')
         .font('Helvetica-Bold')
         .text('Recommendations & Action Items', 50, 130)
         .moveDown(1.5);

      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#333333')
         .text(
           'Based on the comprehensive analysis of KPI submission status, the following recommendations ' +
           'are provided to improve compliance and performance management effectiveness:',
           50,
           { align: 'justify', width: 495 }
         )
         .moveDown(1.5);

      const recommendations = [
        {
          priority: 'HIGH',
          color: '#dc3545',
          title: 'Immediate Follow-up Required',
          items: [
            `${safeNumber(data.withoutKPIs.length)} employees have not submitted KPIs - send reminder notifications`,
            'Schedule one-on-one meetings with non-compliant employees',
            'Escalate repeated non-compliance to department heads'
          ]
        },
        {
          priority: 'MEDIUM',
          color: '#ffc107',
          title: 'Review and Approval Process',
          items: [
            `${safeNumber(byStatus.pending, 0)} KPIs pending review - expedite approval process`,
            'Provide feedback on rejected KPIs within 48 hours',
            'Ensure supervisors are trained on KPI evaluation criteria'
          ]
        },
        {
          priority: 'LOW',
          color: '#28a745',
          title: 'System Improvements',
          items: [
            'Implement automated reminder system for upcoming deadlines',
            'Create KPI templates for common roles to streamline submissions',
            'Schedule quarterly KPI training workshops'
          ]
        }
      ];

      recommendations.forEach((rec, idx) => {
        const checkRecY = safeY(doc);
        if (checkRecY > 600) {
          addFooter();
          doc.addPage();
          addWatermark();
          addHeader('Recommendations');
        }

        const boxTop = safeY(doc);
        
        doc.roundedRect(50, boxTop, 495, 20, 5)
           .fill(rec.color);

        doc.fontSize(10)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(`${rec.priority} PRIORITY: ${rec.title}`, 60, boxTop + 6);

        safeY(doc, boxTop + 30);

        rec.items.forEach((item, itemIdx) => {
          doc.fontSize(10)
             .fillColor('#333333')
             .font('Helvetica')
             .text(`${itemIdx + 1}. ${safeString(item)}`, 65, safeY(doc), { width: 470, align: 'justify' })
             .moveDown(0.5);
        });

        doc.moveDown(1);
      });

      doc.moveDown(2);
      doc.fontSize(9)
         .fillColor('#666666')
         .font('Helvetica-Oblique')
         .text(
           `This report analyzed ${total} active employees across ${safeNumber(Object.keys(deptStats).length)} departments. ` +
           `Current submission rate of ${submissionRate}% ${parseFloat(submissionRate) >= 80 ? 'meets' : 'does not meet'} the organizational target of 80%.`,
           50,
           { align: 'center', width: 495 }
         );

      addFooter();

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        console.log(`✅ Professional PDF Report Generated: ${filepath}`);
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
  
  console.log('🚀 Starting Professional KPI PDF Report Generation...\n');
  console.log(`📌 Excluding ${EXCLUDED_USER_IDS.length} specified users from report`);
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