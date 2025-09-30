const mongoose = require('mongoose');
const { Transaction, Company } = require('../models/PettyCash');

exports.updateCompanyBalance = async (companyId, transactionType, amount) => {
    const company = await Company.findById(companyId);
    if (!company) return;

    let balanceChange = amount;
    // Expenses
    if (['bill', 'advance', 'adv-salary', 'make-cheque'].includes(transactionType)) {
        balanceChange = -amount;
    }

    company.currentBalance += balanceChange;
    await company.save();
};


exports.getCompanySettings = async (req, res) => {
    try {
        const company = await Company.findOne({ createdBy: req.user.userId });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company settings not found. Please set up your company information.'
            });
        }

        res.status(200).json({ success: true, data: company });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCompanySettings = async (req, res) => {
    try {
        const { companyId } = req.params;
        const updates = req.body;
        const documents = req.files;

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        if (!updates.name || !updates.currency) {
            return res.status(400).json({
                success: false,
                message: 'Company name and currency are required'
            });
        }

        // Handle openingBalance: Only allow update if it's the initial setup (openingBalance is 0)
        if (updates.openingBalance !== undefined) {
            const newOpeningBalance = parseFloat(updates.openingBalance);
            if (isNaN(newOpeningBalance) || newOpeningBalance < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Opening balance must be a non-negative valid number'
                });
            }

            // If openingBalance is being set for the first time (from 0 to a new value > 0)
            if (company.openingBalance === 0 && newOpeningBalance > 0) {
                company.openingBalance = newOpeningBalance;
                company.currentBalance = newOpeningBalance; // Initialize currentBalance with openingBalance
            } else if (company.openingBalance !== newOpeningBalance) {

                // Option 2: Allow change, and adjust currentBalance accordingly:
                const oldOpeningBalance = company.openingBalance;
                const balanceDiff = newOpeningBalance - oldOpeningBalance;
                company.openingBalance = newOpeningBalance;
                company.currentBalance += balanceDiff; // Adjust current balance
            }
        }

        // Prepare non-openingBalance updates
        const nonBalanceUpdates = { ...updates };
        delete nonBalanceUpdates.openingBalance; 

        // Apply general updates and record changes for history
        const changedFields = {};
        for (const key in nonBalanceUpdates) {
            // Only update if value is different to avoid unnecessary history entries
            if (company[key] !== nonBalanceUpdates[key]) {
                changedFields[key] = {
                    old: company[key],
                    new: nonBalanceUpdates[key]
                };
                company[key] = nonBalanceUpdates[key]; 
            }
        }
        if (Object.keys(changedFields).length > 0) {
            company.changeHistory.push({
                changedBy: req.user.userId,
                changes: changedFields
            });
        }

        // Process and append new documents
        if (documents && documents.length > 0) {
            const newDocs = documents.map(doc => ({
                filename: doc.originalname,
                path: doc.path,
                mimetype: doc.mimetype,
                size: doc.size,
                uploadedBy: req.user.userId
            }));
            company.documents.push(...newDocs); 
        }

        await company.save(); 

        res.status(200).json({
            success: true,
            message: 'Company settings updated successfully',
            data: company
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


// --- Transactions ---
exports.createTransaction = async (req, res) => {
    try {
        const company = await Company.findOne({ createdBy: req.user.userId });
        if (!company) {
            return res.status(400).json({ success: false, message: 'Company settings not found' });
        }

        const transactionData = {
            ...req.body,
            company: company._id,
            createdBy: req.user.userId
        };

        const transaction = await Transaction.create(transactionData);

        await exports.updateCompanyBalance(company._id, transaction.type, transaction.amount);

        res.status(201).json({ success: true, data: transaction });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const { type, startDate, endDate, page = 1, limit = 10 } = req.query;
        const company = await Company.findOne({ createdBy: req.user.userId });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company settings not found.' });
        }

        const query = { company: company._id };
        if (type) query.type = type;
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const transactions = await Transaction.find(query)
            .sort('-date')
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Transaction.countDocuments(query);

        res.status(200).json({
            success: true,
            data: transactions,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }
        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateTransaction = async (req, res) => {
    try {
        const oldTransaction = await Transaction.findById(req.params.id);
        if (!oldTransaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        const transaction = await Transaction.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (req.body.amount !== undefined || req.body.type !== undefined) {
            // If amount or type changed, re-calculate the balance
            await exports.updateCompanyBalance(oldTransaction.company, oldTransaction.type, -oldTransaction.amount);
            await exports.updateCompanyBalance(transaction.company, transaction.type, transaction.amount); 
        }

        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findByIdAndDelete(req.params.id);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        await exports.updateCompanyBalance(transaction.company, transaction.type, -transaction.amount);

        res.status(200).json({ success: true, message: 'Transaction deleted successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};


exports.getCurrentPosition = async (req, res) => {
    try {
        const company = await Company.findOne({ createdBy: req.user.userId });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company settings not found. Please set up your company information.' });
        }

        // AGGREGATE ALL FINANCIAL DATA FOR THE CURRENT POSITION
        const financialsAggregation = await Transaction.aggregate([
            {
                $match: {
                    company: company._id,
                    status: 'approved' 
                }
            },
            {
                $group: {
                    _id: null,
                    bills: { $sum: { $cond: [{ $eq: ['$type', 'bill'] }, '$amount', 0] } },
                    advances: { $sum: { $cond: [{ $eq: ['$type', 'advance'] }, '$amount', 0] } },
                    advanceSalary: { $sum: { $cond: [{ $eq: ['$type', 'adv-salary'] }, '$amount', 0] } },
                    chequeToEncash: { $sum: { $cond: [{ $eq: ['$type', 'make-cheque'] }, '$amount', 0] } },
                    cashSales: { $sum: { $cond: [{ $eq: ['$type', 'cash-sales'] }, '$amount', 0] } },
                    otherFunding: { $sum: { $cond: [{ $eq: ['$type', 'fund-in'] }, '$amount', 0] } },
                }
            }
        ]);

        const aggregatedFinancials = financialsAggregation.length > 0 ? financialsAggregation[0] : {};

        // Calculate totals based on aggregated data + opening balance
        const totalExpenses = (aggregatedFinancials.bills || 0) +
            (aggregatedFinancials.advances || 0) +
            (aggregatedFinancials.advanceSalary || 0) +
            (aggregatedFinancials.chequeToEncash || 0);

        const totalFundReceived = company.openingBalance +
            (aggregatedFinancials.cashSales || 0) +
            (aggregatedFinancials.otherFunding || 0);

        const cashInHand = totalFundReceived - totalExpenses;

        res.status(200).json({
            success: true,
            data: {
                companyInfo: {
                    name: company.name,
                    address: company.address,
                    city: company.city,
                    telephone: company.telephone,
                    currency: company.currency
                },
                financials: {
                    openingBalance: company.openingBalance,
                    currentBalance: company.currentBalance, 
                    bills: aggregatedFinancials.bills || 0,
                    advances: aggregatedFinancials.advances || 0,
                    advanceSalary: aggregatedFinancials.advanceSalary || 0,
                    chequeToEncash: aggregatedFinancials.chequeToEncash || 0,
                    cashSales: aggregatedFinancials.cashSales || 0,
                    otherFunding: aggregatedFinancials.otherFunding || 0,
                    // Sending calculated totals for clarity in frontend
                    totalExpenses: totalExpenses,
                    totalFundReceived: totalFundReceived,
                    cashInHand: cashInHand
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const company = await Company.findOne({ createdBy: req.user.userId });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company settings not found. Please set up your company information.' });
        }

        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const monthlyExpenses = await Transaction.aggregate([
            {
                $match: {
                    company: company._id,
                    type: { $in: ['bill', 'advance', 'adv-salary', 'make-cheque'] },
                    status: 'approved',
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const monthlyIncome = await Transaction.aggregate([
            {
                $match: {
                    company: company._id,
                    type: { $in: ['cash-sales', 'fund-in'] },
                    status: 'approved',
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                currentBalance: company.currentBalance,
                monthlyExpenses: monthlyExpenses[0]?.total || 0,
                monthlyIncome: monthlyIncome[0]?.total || 0,
                openingBalance: company.openingBalance
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};