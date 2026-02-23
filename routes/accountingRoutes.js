const express = require('express');
const Account = require('../models/Account');
const AccountingRule = require('../models/AccountingRule');
const JournalEntry = require('../models/JournalEntry');
const { authMiddleware, requireRoles } = require('../middlewares/authMiddleware');
const accountingService = require('../services/accountingService');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRoles('finance', 'admin', 'ceo'));

router.post('/bootstrap/default-chart', async (req, res) => {
  try {
    const result = await accountingService.ensureDefaultChart();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to initialize chart of accounts', error: error.message });
  }
});

router.post('/bootstrap/default-rules', async (req, res) => {
  try {
    const result = await accountingService.ensureDefaultRules();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to initialize accounting rules', error: error.message });
  }
});

router.get('/rules', async (req, res) => {
  try {
    const { documentType, sourceType, active } = req.query;
    const filter = {};

    if (documentType) filter.documentType = String(documentType).toLowerCase();
    if (sourceType) filter.sourceType = sourceType;
    if (typeof active !== 'undefined') filter.isActive = active === 'true';

    const rules = await AccountingRule.find(filter).sort({ documentType: 1, priority: 1, createdAt: 1 });
    res.json({ success: true, data: rules, count: rules.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch accounting rules', error: error.message });
  }
});

router.post('/rules', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      documentType: req.body.documentType ? String(req.body.documentType).toLowerCase() : req.body.documentType
    };
    const rule = await AccountingRule.create(payload);
    res.status(201).json({ success: true, data: rule, message: 'Accounting rule created' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to create accounting rule', error: error.message });
  }
});

router.put('/rules/:ruleId', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      documentType: req.body.documentType ? String(req.body.documentType).toLowerCase() : req.body.documentType
    };

    const rule = await AccountingRule.findByIdAndUpdate(req.params.ruleId, payload, {
      new: true,
      runValidators: true
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Accounting rule not found' });
    }

    res.json({ success: true, data: rule, message: 'Accounting rule updated' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to update accounting rule', error: error.message });
  }
});

router.get('/accounts', async (req, res) => {
  try {
    const { type, active } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (typeof active !== 'undefined') filter.isActive = active === 'true';

    const accounts = await Account.find(filter).sort({ code: 1 });
    res.json({ success: true, data: accounts, count: accounts.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch accounts', error: error.message });
  }
});

router.post('/accounts', async (req, res) => {
  try {
    const account = await Account.create(req.body);
    res.status(201).json({ success: true, data: account, message: 'Account created' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to create account', error: error.message });
  }
});

router.get('/journal-entries', async (req, res) => {
  try {
    const { startDate, endDate, sourceType, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (sourceType) filter.sourceType = sourceType;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      JournalEntry.find(filter)
        .populate('lines.account', 'code name')
        .populate('postedBy', 'fullName email')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      JournalEntry.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch journal entries', error: error.message });
  }
});

router.post('/journal-entries', async (req, res) => {
  try {
    const { date, description, lines } = req.body;
    const entry = await accountingService.createJournalEntry({ date, description, lines, sourceType: 'manual' }, req.user.userId);
    res.status(201).json({ success: true, data: entry, message: 'Journal entry posted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to post journal entry', error: error.message });
  }
});

router.post('/journal-entries/:entryId/reverse', async (req, res) => {
  try {
    const entry = await accountingService.reverseJournalEntry(req.params.entryId, req.user.userId, {
      reason: req.body.reason,
      reversalDate: req.body.reversalDate
    });

    res.status(201).json({
      success: true,
      data: entry,
      message: 'Reversal entry posted successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to reverse journal entry', error: error.message });
  }
});

router.get('/periods', async (req, res) => {
  try {
    const periods = await accountingService.listPeriods({
      year: req.query.year,
      status: req.query.status
    });

    res.json({ success: true, data: periods, count: periods.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch accounting periods', error: error.message });
  }
});

router.post('/periods/close', async (req, res) => {
  try {
    const { year, month, notes } = req.body;
    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'year and month are required' });
    }

    const period = await accountingService.setPeriodStatus({
      year,
      month,
      status: 'closed',
      userId: req.user.userId,
      notes
    });

    res.json({ success: true, data: period, message: 'Accounting period closed successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to close accounting period', error: error.message });
  }
});

router.post('/periods/open', async (req, res) => {
  try {
    const { year, month, notes } = req.body;
    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'year and month are required' });
    }

    const period = await accountingService.setPeriodStatus({
      year,
      month,
      status: 'open',
      userId: req.user.userId,
      notes
    });

    res.json({ success: true, data: period, message: 'Accounting period opened successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to open accounting period', error: error.message });
  }
});

router.post('/postings/cash-requests/:requestId/disbursement', async (req, res) => {
  try {
    const entry = await accountingService.postCashRequestDisbursement(req.params.requestId, req.user.userId);
    res.json({ success: true, data: entry, message: 'Cash request disbursement posted to ledger' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to post cash request disbursement', error: error.message });
  }
});

router.post('/postings/supplier-invoices/:invoiceId', async (req, res) => {
  try {
    const entry = await accountingService.postSupplierInvoice(req.params.invoiceId, req.user.userId);
    res.json({ success: true, data: entry, message: 'Supplier invoice posted to ledger' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to post supplier invoice', error: error.message });
  }
});

router.post('/postings/customer-invoices/:invoiceId', async (req, res) => {
  try {
    const entry = await accountingService.postCustomerInvoice(req.params.invoiceId, req.user.userId);
    res.json({ success: true, data: entry, message: 'Customer invoice posted to ledger' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to post customer invoice', error: error.message });
  }
});

router.post('/postings/salary-payments/:paymentId', async (req, res) => {
  try {
    const entry = await accountingService.postSalaryPayment(req.params.paymentId, req.user.userId);
    res.json({ success: true, data: entry, message: 'Salary payment posted to ledger' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to post salary payment', error: error.message });
  }
});

router.get('/reports/trial-balance', async (req, res) => {
  try {
    const result = await accountingService.getTrialBalance({
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate trial balance', error: error.message });
  }
});

router.get('/reports/general-ledger/:accountId', async (req, res) => {
  try {
    const result = await accountingService.getGeneralLedger(req.params.accountId, {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to generate general ledger', error: error.message });
  }
});

module.exports = router;
