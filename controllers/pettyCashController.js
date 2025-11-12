const PurchaseRequisition = require('../models/PurchaseRequisition');
const User = require('../models/User');
const pdfService = require('../services/pdfService');
const { sendEmail } = require('../services/emailService');

/**
 * Get all petty cash forms for buyer dashboard
 */
const getBuyerPettyCashForms = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    
    console.log('=== GET BUYER PETTY CASH FORMS ===');
    console.log('Buyer ID:', buyerId);
    
    // Find all requisitions where:
    // 1. Buyer is assigned
    // 2. Payment method is cash
    // 3. Petty cash form is generated
    const requisitions = await PurchaseRequisition.find({
      'supplyChainReview.assignedBuyer': buyerId,
      'supplyChainReview.paymentMethod': 'cash',
      'pettyCashForm.generated': true
    })
    .populate('employee', 'fullName email department')
    .populate('supplyChainReview.assignedBuyer', 'fullName email')
    .sort({ 'pettyCashForm.generatedDate': -1 });
    
    console.log(`Found ${requisitions.length} petty cash forms`);
    
    // Transform data for frontend
    const pettyCashForms = requisitions.map(req => ({
      id: req._id,
      requisitionNumber: req.requisitionNumber,
      pettyCashFormNumber: req.pettyCashForm.formNumber,
      title: req.title,
      employee: {
        name: req.employee.fullName,
        email: req.employee.email,
        department: req.employee.department
      },
      amountRequested: req.budgetXAF,
      generatedDate: req.pettyCashForm.generatedDate,
      downloadedCount: req.pettyCashForm.downloadedBy?.length || 0,
      lastDownloadDate: req.pettyCashForm.downloadedBy?.length > 0 ? 
        req.pettyCashForm.downloadedBy[req.pettyCashForm.downloadedBy.length - 1].downloadDate : null,
      status: req.pettyCashForm.status,
      urgency: req.urgency,
      itemCategory: req.itemCategory,
      items: req.items
    }));
    
    res.json({
      success: true,
      data: pettyCashForms,
      count: pettyCashForms.length
    });
    
  } catch (error) {
    console.error('Error fetching buyer petty cash forms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch petty cash forms',
      error: error.message
    });
  }
};

/**
 * Get petty cash form details
 */
const getPettyCashFormDetails = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const buyerId = req.user.userId;
    
    console.log('=== GET PETTY CASH FORM DETAILS ===');
    console.log('Requisition ID:', requisitionId);
    console.log('Buyer ID:', buyerId);
    
    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department phone')
      .populate('supplyChainReview.assignedBuyer', 'fullName email')
      .populate('approvalChain.decidedBy', 'fullName email role')
      .populate('financeVerification.verifiedBy', 'fullName email');
    
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }
    
    // Verify buyer is assigned to this requisition
    if (requisition.supplyChainReview.assignedBuyer._id.toString() !== buyerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this petty cash form'
      });
    }
    
    // Verify petty cash form exists
    if (!requisition.pettyCashForm?.generated) {
      return res.status(404).json({
        success: false,
        message: 'Petty cash form not generated for this requisition'
      });
    }
    
    // Return complete details
    res.json({
      success: true,
      data: {
        requisition: {
          id: requisition._id,
          requisitionNumber: requisition.requisitionNumber,
          title: requisition.title,
          department: requisition.department,
          itemCategory: requisition.itemCategory,
          urgency: requisition.urgency,
          budgetXAF: requisition.budgetXAF,
          deliveryLocation: requisition.deliveryLocation,
          expectedDate: requisition.expectedDate,
          justificationOfPurchase: requisition.justificationOfPurchase,
          items: requisition.items,
          status: requisition.status
        },
        employee: {
          name: requisition.employee.fullName,
          email: requisition.employee.email,
          department: requisition.employee.department,
          phone: requisition.employee.phone
        },
        pettyCashForm: {
          formNumber: requisition.pettyCashForm.formNumber,
          generatedDate: requisition.pettyCashForm.generatedDate,
          status: requisition.pettyCashForm.status,
          downloadedCount: requisition.pettyCashForm.downloadedBy?.length || 0,
          downloadHistory: requisition.pettyCashForm.downloadedBy
        },
        approvalChain: requisition.approvalChain.map(step => ({
          level: step.level,
          approver: step.approver,
          status: step.status,
          comments: step.comments,
          actionDate: step.actionDate,
          actionTime: step.actionTime
        })),
        financeVerification: {
          budgetAvailable: requisition.financeVerification.budgetAvailable,
          assignedBudget: requisition.financeVerification.assignedBudget,
          budgetCode: requisition.financeVerification.budgetCode,
          comments: requisition.financeVerification.comments,
          verifiedBy: requisition.financeVerification.verifiedBy?.fullName,
          verificationDate: requisition.financeVerification.verificationDate
        },
        paymentMethod: requisition.supplyChainReview.paymentMethod
      }
    });
    
  } catch (error) {
    console.error('Error fetching petty cash form details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch petty cash form details',
      error: error.message
    });
  }
};

/**
 * Download petty cash form as PDF
 */
const downloadPettyCashFormPDF = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const buyerId = req.user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    console.log('=== DOWNLOAD PETTY CASH FORM PDF ===');
    console.log('Requisition ID:', requisitionId);
    console.log('Buyer ID:', buyerId);
    
    const requisition = await PurchaseRequisition.findById(requisitionId)
      .populate('employee', 'fullName email department phone')
      .populate('supplyChainReview.assignedBuyer', 'fullName email')
      .populate('approvalChain.decidedBy', 'fullName email role')
      .populate('financeVerification.verifiedBy', 'fullName email');
    
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }
    
    // Verify buyer is assigned
    if (requisition.supplyChainReview.assignedBuyer._id.toString() !== buyerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to download this form'
      });
    }
    
    // Verify petty cash form exists
    if (!requisition.pettyCashForm?.generated) {
      return res.status(404).json({
        success: false,
        message: 'Petty cash form not generated for this requisition'
      });
    }
    
    // Prepare data for PDF generation
    const pdfData = {
      _id: requisition._id,
      displayId: requisition.pettyCashForm.formNumber,
      requisitionNumber: requisition.requisitionNumber,
      title: requisition.title,
      department: requisition.department,
      itemCategory: requisition.itemCategory,
      urgency: requisition.urgency,
      amountRequested: requisition.budgetXAF,
      deliveryLocation: requisition.deliveryLocation,
      expectedDate: requisition.expectedDate,
      purpose: requisition.justificationOfPurchase,
      businessJustification: requisition.justificationOfPurchase,
      items: requisition.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        measuringUnit: item.measuringUnit,
        estimatedPrice: item.estimatedPrice,
        totalPrice: item.quantity * (item.estimatedPrice || 0)
      })),
      employee: {
        fullName: requisition.employee.fullName,
        email: requisition.employee.email,
        department: requisition.employee.department,
        phone: requisition.employee.phone
      },
      status: 'approved', // Always approved for petty cash forms
      createdAt: requisition.pettyCashForm.generatedDate,
      approvalChain: requisition.approvalChain.map(step => ({
        level: step.level,
        approver: {
          name: step.approver.name,
          email: step.approver.email,
          role: step.approver.role,
          department: step.approver.department
        },
        status: step.status,
        comments: step.comments,
        actionDate: step.actionDate,
        actionTime: step.actionTime
      })),
      financeVerification: {
        budgetAvailable: requisition.financeVerification.budgetAvailable,
        assignedBudget: requisition.financeVerification.assignedBudget,
        budgetCode: requisition.financeVerification.budgetCode,
        comments: requisition.financeVerification.comments
      },
      disbursementDetails: {
        amount: requisition.financeVerification.assignedBudget || requisition.budgetXAF,
        date: requisition.pettyCashForm.generatedDate
      },
      requestType: 'petty-cash',
      paymentMethod: 'cash'
    };
    
    console.log('Generating PDF for petty cash form:', pdfData.displayId);
    
    // Generate PDF using the same format as cash request
    const pdfResult = await pdfService.generatePettyCashFormPDF(pdfData);
    
    if (!pdfResult.success) {
      console.error('PDF generation failed:', pdfResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF',
        error: pdfResult.error
      });
    }
    
    console.log('PDF generated successfully:', pdfResult.filename);
    
    // Record download
    await requisition.recordPettyCashFormDownload(buyerId, ipAddress);
    
    console.log('Download recorded for buyer:', buyerId);
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
    res.setHeader('Content-Length', pdfResult.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send the PDF buffer
    res.send(pdfResult.buffer);
    
    console.log('PDF download completed for petty cash form:', pdfData.displayId);
    
  } catch (error) {
    console.error('Error downloading petty cash form PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download petty cash form PDF',
      error: error.message
    });
  }
};

/**
 * Get buyer petty cash form statistics
 */
const getBuyerPettyCashStats = async (req, res) => {
  try {
    const buyerId = req.user.userId;
    
    console.log('=== GET BUYER PETTY CASH STATS ===');
    console.log('Buyer ID:', buyerId);
    
    const requisitions = await PurchaseRequisition.find({
      'supplyChainReview.assignedBuyer': buyerId,
      'supplyChainReview.paymentMethod': 'cash',
      'pettyCashForm.generated': true
    });
    
    const stats = {
      total: requisitions.length,
      pendingDownload: requisitions.filter(req => 
        req.pettyCashForm.status === 'pending_download'
      ).length,
      downloaded: requisitions.filter(req => 
        req.pettyCashForm.status === 'downloaded'
      ).length,
      totalAmount: requisitions.reduce((sum, req) => sum + (req.budgetXAF || 0), 0),
      byUrgency: {
        high: requisitions.filter(req => req.urgency === 'High').length,
        medium: requisitions.filter(req => req.urgency === 'Medium').length,
        low: requisitions.filter(req => req.urgency === 'Low').length
      }
    };
    
    console.log('Petty cash stats:', stats);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error fetching petty cash stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch petty cash statistics',
      error: error.message
    });
  }
};

/**
 * Mark petty cash form as completed
 */
const markPettyCashFormComplete = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const buyerId = req.user.userId;
    
    console.log('=== MARK PETTY CASH FORM COMPLETE ===');
    console.log('Requisition ID:', requisitionId);
    
    const requisition = await PurchaseRequisition.findById(requisitionId);
    
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }
    
    // Verify buyer is assigned
    if (requisition.supplyChainReview.assignedBuyer.toString() !== buyerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this form'
      });
    }
    
    // Update petty cash form status
    requisition.pettyCashForm.status = 'completed';
    await requisition.save();
    
    console.log('Petty cash form marked as completed');
    
    res.json({
      success: true,
      message: 'Petty cash form marked as completed',
      data: {
        requisitionId: requisition._id,
        formNumber: requisition.pettyCashForm.formNumber,
        status: requisition.pettyCashForm.status
      }
    });
    
  } catch (error) {
    console.error('Error marking petty cash form complete:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark petty cash form as complete',
      error: error.message
    });
  }
};

module.exports = {
  getBuyerPettyCashForms,
  getPettyCashFormDetails,
  downloadPettyCashFormPDF,
  getBuyerPettyCashStats,
  markPettyCashFormComplete
};










// const mongoose = require('mongoose');
// const { Transaction, Company } = require('../models/PettyCash');

// exports.updateCompanyBalance = async (companyId, transactionType, amount) => {
//     const company = await Company.findById(companyId);
//     if (!company) return;

//     let balanceChange = amount;
//     // Expenses
//     if (['bill', 'advance', 'adv-salary', 'make-cheque'].includes(transactionType)) {
//         balanceChange = -amount;
//     }

//     company.currentBalance += balanceChange;
//     await company.save();
// };


// exports.getCompanySettings = async (req, res) => {
//     try {
//         const company = await Company.findOne({ createdBy: req.user.userId });

//         if (!company) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Company settings not found. Please set up your company information.'
//             });
//         }

//         res.status(200).json({ success: true, data: company });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

// exports.updateCompanySettings = async (req, res) => {
//     try {
//         const { companyId } = req.params;
//         const updates = req.body;
//         const documents = req.files;

//         const company = await Company.findById(companyId);
//         if (!company) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Company not found'
//             });
//         }

//         if (!updates.name || !updates.currency) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Company name and currency are required'
//             });
//         }

//         // Handle openingBalance: Only allow update if it's the initial setup (openingBalance is 0)
//         if (updates.openingBalance !== undefined) {
//             const newOpeningBalance = parseFloat(updates.openingBalance);
//             if (isNaN(newOpeningBalance) || newOpeningBalance < 0) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Opening balance must be a non-negative valid number'
//                 });
//             }

//             // If openingBalance is being set for the first time (from 0 to a new value > 0)
//             if (company.openingBalance === 0 && newOpeningBalance > 0) {
//                 company.openingBalance = newOpeningBalance;
//                 company.currentBalance = newOpeningBalance; // Initialize currentBalance with openingBalance
//             } else if (company.openingBalance !== newOpeningBalance) {

//                 // Option 2: Allow change, and adjust currentBalance accordingly:
//                 const oldOpeningBalance = company.openingBalance;
//                 const balanceDiff = newOpeningBalance - oldOpeningBalance;
//                 company.openingBalance = newOpeningBalance;
//                 company.currentBalance += balanceDiff; // Adjust current balance
//             }
//         }

//         // Prepare non-openingBalance updates
//         const nonBalanceUpdates = { ...updates };
//         delete nonBalanceUpdates.openingBalance; 

//         // Apply general updates and record changes for history
//         const changedFields = {};
//         for (const key in nonBalanceUpdates) {
//             // Only update if value is different to avoid unnecessary history entries
//             if (company[key] !== nonBalanceUpdates[key]) {
//                 changedFields[key] = {
//                     old: company[key],
//                     new: nonBalanceUpdates[key]
//                 };
//                 company[key] = nonBalanceUpdates[key]; 
//             }
//         }
//         if (Object.keys(changedFields).length > 0) {
//             company.changeHistory.push({
//                 changedBy: req.user.userId,
//                 changes: changedFields
//             });
//         }

//         // Process and append new documents
//         if (documents && documents.length > 0) {
//             const newDocs = documents.map(doc => ({
//                 filename: doc.originalname,
//                 path: doc.path,
//                 mimetype: doc.mimetype,
//                 size: doc.size,
//                 uploadedBy: req.user.userId
//             }));
//             company.documents.push(...newDocs); 
//         }

//         await company.save(); 

//         res.status(200).json({
//             success: true,
//             message: 'Company settings updated successfully',
//             data: company
//         });
//     } catch (error) {
//         res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
// };


// // --- Transactions ---
// exports.createTransaction = async (req, res) => {
//     try {
//         const company = await Company.findOne({ createdBy: req.user.userId });
//         if (!company) {
//             return res.status(400).json({ success: false, message: 'Company settings not found' });
//         }

//         const transactionData = {
//             ...req.body,
//             company: company._id,
//             createdBy: req.user.userId
//         };

//         const transaction = await Transaction.create(transactionData);

//         await exports.updateCompanyBalance(company._id, transaction.type, transaction.amount);

//         res.status(201).json({ success: true, data: transaction });
//     } catch (error) {
//         res.status(400).json({ success: false, message: error.message });
//     }
// };

// exports.getTransactions = async (req, res) => {
//     try {
//         const { type, startDate, endDate, page = 1, limit = 10 } = req.query;
//         const company = await Company.findOne({ createdBy: req.user.userId });
//         if (!company) {
//             return res.status(404).json({ success: false, message: 'Company settings not found.' });
//         }

//         const query = { company: company._id };
//         if (type) query.type = type;
//         if (startDate && endDate) {
//             query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
//         }

//         const transactions = await Transaction.find(query)
//             .sort('-date')
//             .skip((page - 1) * limit)
//             .limit(Number(limit));

//         const total = await Transaction.countDocuments(query);

//         res.status(200).json({
//             success: true,
//             data: transactions,
//             pagination: {
//                 currentPage: Number(page),
//                 totalPages: Math.ceil(total / limit),
//                 totalItems: total
//             }
//         });
//     } catch (error) {
//         res.status(400).json({ success: false, message: error.message });
//     }
// };

// exports.getTransaction = async (req, res) => {
//     try {
//         const transaction = await Transaction.findById(req.params.id);
//         if (!transaction) {
//             return res.status(404).json({ success: false, message: 'Transaction not found' });
//         }
//         res.status(200).json({ success: true, data: transaction });
//     } catch (error) {
//         res.status(400).json({ success: false, message: error.message });
//     }
// };

// exports.updateTransaction = async (req, res) => {
//     try {
//         const oldTransaction = await Transaction.findById(req.params.id);
//         if (!oldTransaction) {
//             return res.status(404).json({ success: false, message: 'Transaction not found' });
//         }

//         const transaction = await Transaction.findByIdAndUpdate(
//             req.params.id,
//             req.body,
//             { new: true, runValidators: true }
//         );

//         if (req.body.amount !== undefined || req.body.type !== undefined) {
//             // If amount or type changed, re-calculate the balance
//             await exports.updateCompanyBalance(oldTransaction.company, oldTransaction.type, -oldTransaction.amount);
//             await exports.updateCompanyBalance(transaction.company, transaction.type, transaction.amount); 
//         }

//         res.status(200).json({ success: true, data: transaction });
//     } catch (error) {
//         res.status(400).json({ success: false, message: error.message });
//     }
// };

// exports.deleteTransaction = async (req, res) => {
//     try {
//         const transaction = await Transaction.findByIdAndDelete(req.params.id);
//         if (!transaction) {
//             return res.status(404).json({ success: false, message: 'Transaction not found' });
//         }

//         await exports.updateCompanyBalance(transaction.company, transaction.type, -transaction.amount);

//         res.status(200).json({ success: true, message: 'Transaction deleted successfully' });
//     } catch (error) {
//         res.status(400).json({ success: false, message: error.message });
//     }
// };


// exports.getCurrentPosition = async (req, res) => {
//     try {
//         const company = await Company.findOne({ createdBy: req.user.userId });
//         if (!company) {
//             return res.status(404).json({ success: false, message: 'Company settings not found. Please set up your company information.' });
//         }

//         // AGGREGATE ALL FINANCIAL DATA FOR THE CURRENT POSITION
//         const financialsAggregation = await Transaction.aggregate([
//             {
//                 $match: {
//                     company: company._id,
//                     status: 'approved' 
//                 }
//             },
//             {
//                 $group: {
//                     _id: null,
//                     bills: { $sum: { $cond: [{ $eq: ['$type', 'bill'] }, '$amount', 0] } },
//                     advances: { $sum: { $cond: [{ $eq: ['$type', 'advance'] }, '$amount', 0] } },
//                     advanceSalary: { $sum: { $cond: [{ $eq: ['$type', 'adv-salary'] }, '$amount', 0] } },
//                     chequeToEncash: { $sum: { $cond: [{ $eq: ['$type', 'make-cheque'] }, '$amount', 0] } },
//                     cashSales: { $sum: { $cond: [{ $eq: ['$type', 'cash-sales'] }, '$amount', 0] } },
//                     otherFunding: { $sum: { $cond: [{ $eq: ['$type', 'fund-in'] }, '$amount', 0] } },
//                 }
//             }
//         ]);

//         const aggregatedFinancials = financialsAggregation.length > 0 ? financialsAggregation[0] : {};

//         // Calculate totals based on aggregated data + opening balance
//         const totalExpenses = (aggregatedFinancials.bills || 0) +
//             (aggregatedFinancials.advances || 0) +
//             (aggregatedFinancials.advanceSalary || 0) +
//             (aggregatedFinancials.chequeToEncash || 0);

//         const totalFundReceived = company.openingBalance +
//             (aggregatedFinancials.cashSales || 0) +
//             (aggregatedFinancials.otherFunding || 0);

//         const cashInHand = totalFundReceived - totalExpenses;

//         res.status(200).json({
//             success: true,
//             data: {
//                 companyInfo: {
//                     name: company.name,
//                     address: company.address,
//                     city: company.city,
//                     telephone: company.telephone,
//                     currency: company.currency
//                 },
//                 financials: {
//                     openingBalance: company.openingBalance,
//                     currentBalance: company.currentBalance, 
//                     bills: aggregatedFinancials.bills || 0,
//                     advances: aggregatedFinancials.advances || 0,
//                     advanceSalary: aggregatedFinancials.advanceSalary || 0,
//                     chequeToEncash: aggregatedFinancials.chequeToEncash || 0,
//                     cashSales: aggregatedFinancials.cashSales || 0,
//                     otherFunding: aggregatedFinancials.otherFunding || 0,
//                     // Sending calculated totals for clarity in frontend
//                     totalExpenses: totalExpenses,
//                     totalFundReceived: totalFundReceived,
//                     cashInHand: cashInHand
//                 }
//             }
//         });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

// exports.getDashboardStats = async (req, res) => {
//     try {
//         const company = await Company.findOne({ createdBy: req.user.userId });
//         if (!company) {
//             return res.status(404).json({ success: false, message: 'Company settings not found. Please set up your company information.' });
//         }

//         const today = new Date();
//         const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
//         const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
//         endOfMonth.setHours(23, 59, 59, 999);

//         const monthlyExpenses = await Transaction.aggregate([
//             {
//                 $match: {
//                     company: company._id,
//                     type: { $in: ['bill', 'advance', 'adv-salary', 'make-cheque'] },
//                     status: 'approved',
//                     date: { $gte: startOfMonth, $lte: endOfMonth }
//                 }
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: { $sum: '$amount' }
//                 }
//             }
//         ]);

//         const monthlyIncome = await Transaction.aggregate([
//             {
//                 $match: {
//                     company: company._id,
//                     type: { $in: ['cash-sales', 'fund-in'] },
//                     status: 'approved',
//                     date: { $gte: startOfMonth, $lte: endOfMonth }
//                 }
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: { $sum: '$amount' }
//                 }
//             }
//         ]);

//         res.status(200).json({
//             success: true,
//             data: {
//                 currentBalance: company.currentBalance,
//                 monthlyExpenses: monthlyExpenses[0]?.total || 0,
//                 monthlyIncome: monthlyIncome[0]?.total || 0,
//                 openingBalance: company.openingBalance
//             }
//         });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };