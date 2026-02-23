const mongoose = require('mongoose');
const Account = require('../models/Account');
const AccountingRule = require('../models/AccountingRule');
const AccountingPeriod = require('../models/AccountingPeriod');
const JournalEntry = require('../models/JournalEntry');
const CashRequest = require('../models/CashRequest');
const SupplierInvoice = require('../models/SupplierInvoice');
const Invoice = require('../models/Invoice');
const SalaryPayment = require('../models/SalaryPayment');

const DEFAULT_CHART = [
  { code: '1000', name: 'Cash on Hand', type: 'asset', subType: 'current_asset', normalBalance: 'debit' },
  { code: '1010', name: 'Bank Account', type: 'asset', subType: 'current_asset', normalBalance: 'debit' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subType: 'current_asset', normalBalance: 'debit' },
  { code: '1300', name: 'VAT Receivable', type: 'asset', subType: 'current_asset', normalBalance: 'debit' },
  { code: '1200', name: 'Staff Advances', type: 'asset', subType: 'current_asset', normalBalance: 'debit' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', subType: 'current_liability', normalBalance: 'credit' },
  { code: '2200', name: 'VAT Payable', type: 'liability', subType: 'current_liability', normalBalance: 'credit' },
  { code: '2100', name: 'Accrued Expenses', type: 'liability', subType: 'current_liability', normalBalance: 'credit' },
  { code: '3000', name: 'Owner Equity', type: 'equity', subType: 'equity', normalBalance: 'credit' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue', subType: 'operating_revenue', normalBalance: 'credit' },
  { code: '5000', name: 'Cost of Services', type: 'expense', subType: 'cost_of_sales', normalBalance: 'debit' },
  { code: '5100', name: 'Salaries Expense', type: 'expense', subType: 'operating_expense', normalBalance: 'debit' },
  { code: '5200', name: 'Transport Expense', type: 'expense', subType: 'operating_expense', normalBalance: 'debit' },
  { code: '5300', name: 'General Admin Expense', type: 'expense', subType: 'operating_expense', normalBalance: 'debit' }
];

const DEFAULT_MAPPINGS = {
  CASH: '1000',
  BANK: '1010',
  AR: '1100',
  VAT_RECEIVABLE: '1300',
  STAFF_ADVANCES: '1200',
  AP: '2000',
  VAT_PAYABLE: '2200',
  SALES: '4000',
  SALARIES_EXP: '5100',
  TRANSPORT_EXP: '5200',
  ADMIN_EXP: '5300'
};

const DEFAULT_RULES = [
  {
    name: 'Sales Invoice Standard',
    documentType: 'sales_invoice',
    sourceType: 'customer_invoice',
    description: 'Debit receivable, credit revenue and VAT payable where applicable',
    priority: 10,
    isActive: true,
    taxConfig: { enabled: true, defaultRate: 19.25 },
    lines: [
      { side: 'debit', accountCode: DEFAULT_MAPPINGS.AR, amountSource: 'gross', description: 'Accounts receivable' },
      { side: 'credit', accountCode: DEFAULT_MAPPINGS.SALES, amountSource: 'net', description: 'Sales revenue' },
      { side: 'credit', accountCode: DEFAULT_MAPPINGS.VAT_PAYABLE, amountSource: 'tax', description: 'VAT on sales', optional: true }
    ]
  },
  {
    name: 'Supplier Bill Standard',
    documentType: 'supplier_bill',
    sourceType: 'supplier_invoice',
    description: 'Debit expense and VAT receivable where applicable, credit accounts payable',
    priority: 10,
    isActive: true,
    taxConfig: { enabled: true, defaultRate: 19.25 },
    lines: [
      { side: 'debit', accountCode: DEFAULT_MAPPINGS.ADMIN_EXP, amountSource: 'net', description: 'Supplier expense' },
      { side: 'debit', accountCode: DEFAULT_MAPPINGS.VAT_RECEIVABLE, amountSource: 'tax', description: 'VAT receivable on purchases', optional: true },
      { side: 'credit', accountCode: DEFAULT_MAPPINGS.AP, amountSource: 'gross', description: 'Accounts payable to supplier' }
    ]
  },
  {
    name: 'Cash Disbursement Standard',
    documentType: 'cash_disbursement',
    sourceType: 'cash_request_disbursement',
    description: 'Debit staff advances, credit cash',
    priority: 10,
    isActive: true,
    taxConfig: { enabled: false, defaultRate: 0 },
    lines: [
      { side: 'debit', accountCode: DEFAULT_MAPPINGS.STAFF_ADVANCES, amountSource: 'gross', description: 'Staff advance issued' },
      { side: 'credit', accountCode: DEFAULT_MAPPINGS.CASH, amountSource: 'gross', description: 'Cash paid out' }
    ]
  },
  {
    name: 'Salary Payment Standard',
    documentType: 'salary_payment',
    sourceType: 'salary_payment',
    description: 'Debit salaries expense, credit cash',
    priority: 10,
    isActive: true,
    taxConfig: { enabled: false, defaultRate: 0 },
    lines: [
      { side: 'debit', accountCode: DEFAULT_MAPPINGS.SALARIES_EXP, amountSource: 'gross', description: 'Salary expense recognized' },
      { side: 'credit', accountCode: DEFAULT_MAPPINGS.CASH, amountSource: 'gross', description: 'Cash salary payout' }
    ]
  }
];

function roundAmount(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function getPeriodParts(date) {
  const periodDate = date ? new Date(date) : new Date();
  return {
    year: periodDate.getFullYear(),
    month: periodDate.getMonth() + 1
  };
}

async function ensureOpenPeriod(date) {
  const { year, month } = getPeriodParts(date);
  const period = await AccountingPeriod.findOne({ year, month }).lean();

  if (period?.status === 'closed') {
    throw new Error(`Posting period ${year}-${String(month).padStart(2, '0')} is closed`);
  }

  return { year, month, period: period || null };
}

async function setPeriodStatus({ year, month, status, userId, notes = '' }) {
  if (!['open', 'closed'].includes(status)) {
    throw new Error('Invalid period status. Must be open or closed');
  }

  const update = {
    status,
    notes: notes || '',
    closedAt: status === 'closed' ? new Date() : null,
    closedBy: status === 'closed' ? userId : null
  };

  const period = await AccountingPeriod.findOneAndUpdate(
    { year: Number(year), month: Number(month) },
    { $set: update, $setOnInsert: { year: Number(year), month: Number(month) } },
    { upsert: true, new: true, runValidators: true }
  );

  return period;
}

async function listPeriods({ year, status }) {
  const filter = {};
  if (year) filter.year = Number(year);
  if (status) filter.status = status;

  return AccountingPeriod.find(filter)
    .populate('closedBy', 'fullName email')
    .sort({ year: -1, month: -1 })
    .lean();
}

function getPathValue(object, path) {
  if (!object || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), object);
}

function getContextAmounts(context = {}) {
  const gross = roundAmount(context.grossAmount);
  const tax = roundAmount(context.taxAmount);
  const net = roundAmount(
    context.netAmount !== undefined && context.netAmount !== null
      ? context.netAmount
      : (gross - tax)
  );

  return { gross, net, tax };
}

function resolveRuleLineAmount(line, context) {
  const amounts = getContextAmounts(context);

  if (line.amountSource === 'gross') return amounts.gross;
  if (line.amountSource === 'net') return amounts.net;
  if (line.amountSource === 'tax') return amounts.tax;
  if (line.amountSource === 'fixed') return roundAmount(line.fixedAmount);
  if (line.amountSource === 'field') return roundAmount(getPathValue(context, line.fieldPath));
  return 0;
}

function balanceLines(lines) {
  const debitTotal = roundAmount(lines.reduce((sum, line) => sum + (line.debit || 0), 0));
  const creditTotal = roundAmount(lines.reduce((sum, line) => sum + (line.credit || 0), 0));
  const difference = roundAmount(debitTotal - creditTotal);

  if (difference === 0) return lines;
  if (Math.abs(difference) > 0.01) {
    throw new Error(`Unbalanced rule output: debit=${debitTotal}, credit=${creditTotal}`);
  }

  const sideToAdjust = difference > 0 ? 'credit' : 'debit';
  const candidateIndex = lines
    .map((line, index) => ({ index, amount: line[sideToAdjust] || 0 }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0]?.index;

  if (candidateIndex === undefined) {
    throw new Error('Unable to auto-balance generated lines');
  }

  lines[candidateIndex][sideToAdjust] = roundAmount(lines[candidateIndex][sideToAdjust] + Math.abs(difference));
  return lines;
}

async function buildJournalLinesFromRule(rule, context) {
  const lines = [];

  for (const ruleLine of (rule.lines || [])) {
    const amount = resolveRuleLineAmount(ruleLine, context);

    if (amount <= 0) {
      if (ruleLine.optional) continue;
      continue;
    }

    const account = await getAccountByCode(ruleLine.accountCode);
    lines.push({
      account: account._id,
      description: ruleLine.description || '',
      debit: ruleLine.side === 'debit' ? amount : 0,
      credit: ruleLine.side === 'credit' ? amount : 0
    });
  }

  if (lines.length < 2) {
    throw new Error(`Rule ${rule.name || rule.documentType} did not produce enough journal lines`);
  }

  return balanceLines(lines);
}

async function stampAccountingAudit(Model, sourceId, sourceType, entry) {
  if (!sourceId || !entry) return;

  await Model.findByIdAndUpdate(sourceId, {
    $set: {
      accountingAudit: {
        isPosted: true,
        postedAt: entry.date || entry.createdAt || new Date(),
        entryId: entry._id,
        entryNumber: entry.entryNumber,
        sourceType
      }
    }
  });
}

async function nextEntryNumber(session = null) {
  const now = new Date();
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `JE-${period}-`;

  const latest = await JournalEntry.findOne({ entryNumber: { $regex: `^${prefix}` } })
    .sort({ createdAt: -1 })
    .session(session || null)
    .lean();

  let nextCounter = 1;
  if (latest?.entryNumber) {
    const parts = latest.entryNumber.split('-');
    const counter = Number(parts[2]);
    if (!Number.isNaN(counter)) nextCounter = counter + 1;
  }

  return `${prefix}${String(nextCounter).padStart(5, '0')}`;
}

async function ensureDefaultChart() {
  let created = 0;
  for (const account of DEFAULT_CHART) {
    const result = await Account.updateOne(
      { code: account.code },
      { $setOnInsert: account },
      { upsert: true }
    );

    if (result.upsertedCount > 0) created += 1;
  }

  return {
    created,
    message: created > 0 ? 'Default chart of accounts initialized/updated' : 'Chart of accounts already initialized'
  };
}

async function ensureDefaultRules() {
  let created = 0;

  for (const rule of DEFAULT_RULES) {
    const result = await AccountingRule.updateOne(
      { documentType: rule.documentType, sourceType: rule.sourceType, name: rule.name },
      { $setOnInsert: rule },
      { upsert: true }
    );

    if (result.upsertedCount > 0) created += 1;
  }

  return {
    created,
    message: created > 0 ? 'Default accounting rules initialized' : 'Accounting rules already initialized'
  };
}

async function getActiveRule(documentType, sourceType = '') {
  const primary = await AccountingRule.findOne({
    documentType,
    sourceType,
    isActive: true
  }).sort({ priority: 1, createdAt: 1 });

  if (primary) return primary;

  return AccountingRule.findOne({
    documentType,
    isActive: true
  }).sort({ priority: 1, createdAt: 1 });
}

async function postByRule({
  documentType,
  sourceType,
  sourceId,
  date,
  description,
  context,
  userId,
  auditModel
}) {
  await ensureDefaultChart();
  await ensureDefaultRules();

  const existing = await JournalEntry.findOne({ sourceType, sourceId, status: 'posted' });
  if (existing) {
    await stampAccountingAudit(auditModel, sourceId, sourceType, existing);
    return existing;
  }

  const rule = await getActiveRule(documentType, sourceType);
  if (!rule) {
    throw new Error(`No active accounting rule found for ${documentType}`);
  }

  const lines = await buildJournalLinesFromRule(rule, context);

  const entry = await createJournalEntry({
    date,
    description,
    sourceType,
    sourceId,
    lines
  }, userId);

  await stampAccountingAudit(auditModel, sourceId, sourceType, entry);
  return entry;
}

async function getAccountByCode(code) {
  const account = await Account.findOne({ code, isActive: true });
  if (!account) {
    throw new Error(`Account not found for code ${code}. Initialize chart first.`);
  }
  return account;
}

async function createJournalEntry({ date, description, sourceType = 'manual', sourceId = null, lines }, userId) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('Journal entry requires at least 2 lines');
  }

  const sanitized = lines.map((line) => ({
    account: line.account,
    description: line.description || '',
    debit: Number(line.debit) || 0,
    credit: Number(line.credit) || 0
  }));

  const postingDate = date || new Date();
  await ensureOpenPeriod(postingDate);

  const entryNumber = await nextEntryNumber();

  const journalEntry = await JournalEntry.create({
    entryNumber,
    date: postingDate,
    description,
    sourceType,
    sourceId,
    lines: sanitized,
    postedBy: userId
  });

  return journalEntry;
}

async function reverseJournalEntry(entryId, userId, { reason = '', reversalDate = null } = {}) {
  if (!mongoose.Types.ObjectId.isValid(entryId)) {
    throw new Error('Invalid journal entry ID');
  }

  const original = await JournalEntry.findById(entryId).lean();
  if (!original) {
    throw new Error('Original journal entry not found');
  }

  if (original.isReversal) {
    throw new Error('Cannot reverse a reversal entry');
  }

  const existingReversal = await JournalEntry.findOne({ reversalOf: original._id, status: 'posted' }).lean();
  if (existingReversal) {
    return existingReversal;
  }

  const lines = (original.lines || []).map((line) => ({
    account: line.account,
    description: `Reversal of ${original.entryNumber}${line.description ? ` - ${line.description}` : ''}`,
    debit: Number(line.credit || 0),
    credit: Number(line.debit || 0)
  }));

  const description = `Reversal entry for ${original.entryNumber}${reason ? `: ${reason}` : ''}`;
  const entryNumber = await nextEntryNumber();
  const dateToUse = reversalDate ? new Date(reversalDate) : new Date();

  await ensureOpenPeriod(dateToUse);

  return JournalEntry.create({
    entryNumber,
    date: dateToUse,
    description,
    sourceType: 'reversal',
    sourceId: original.sourceId || null,
    lines,
    postedBy: userId,
    isReversal: true,
    reversalOf: original._id,
    reversalReason: reason || ''
  });
}

async function postCashRequestDisbursement(requestId, userId) {
  const request = await CashRequest.findById(requestId).lean();
  if (!request) throw new Error('Cash request not found');

  const amount = Number(request.totalDisbursed || 0);
  if (amount <= 0) throw new Error('Cash request has no disbursed amount to post');

  return postByRule({
    documentType: 'cash_disbursement',
    sourceType: 'cash_request_disbursement',
    sourceId: request._id,
    date: new Date(),
    description: `Cash disbursement posted for ${request.displayId || request._id}`,
    context: {
      grossAmount: amount,
      netAmount: amount,
      taxAmount: 0
    },
    userId,
    auditModel: CashRequest
  });
}

async function postSupplierInvoice(invoiceId, userId) {
  const invoice = await SupplierInvoice.findById(invoiceId).lean();
  if (!invoice) throw new Error('Supplier invoice not found');

  const grossAmount = Number(invoice.invoiceAmount || 0);
  if (grossAmount <= 0) throw new Error('Supplier invoice amount must be greater than zero');
  const taxAmount = Number(invoice.taxAmount || 0);
  const netAmount = Number(invoice.netAmount || (grossAmount - taxAmount));

  return postByRule({
    documentType: 'supplier_bill',
    sourceType: 'supplier_invoice',
    sourceId: invoice._id,
    date: invoice.invoiceDate || new Date(),
    description: `Supplier invoice ${invoice.invoiceNumber || invoice._id}`,
    context: {
      grossAmount,
      netAmount,
      taxAmount,
      invoice
    },
    userId,
    auditModel: SupplierInvoice
  });
}

async function postCustomerInvoice(invoiceId, userId) {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw new Error('Customer invoice not found');

  const grossAmount = Number(invoice.totalAmount || 0);
  if (grossAmount <= 0) throw new Error('Customer invoice amount must be greater than zero');
  const taxAmount = Number(invoice.taxAmount || 0);
  const netAmount = Number(invoice.netAmount || (grossAmount - taxAmount));

  return postByRule({
    documentType: 'sales_invoice',
    sourceType: 'customer_invoice',
    sourceId: invoice._id,
    date: invoice.invoiceDate || new Date(),
    description: `Customer invoice ${invoice.invoiceNumber || invoice._id}`,
    context: {
      grossAmount,
      netAmount,
      taxAmount,
      invoice
    },
    userId,
    auditModel: Invoice
  });
}

async function postSalaryPayment(paymentId, userId) {
  const payment = await SalaryPayment.findById(paymentId).lean();
  if (!payment) throw new Error('Salary payment not found');

  const amount = Number(payment.totalAmount || 0);
  if (amount <= 0) throw new Error('Salary payment amount must be greater than zero');

  return postByRule({
    documentType: 'salary_payment',
    sourceType: 'salary_payment',
    sourceId: payment._id,
    date: payment.processedAt || new Date(),
    description: `Salary payment ${payment.paymentPeriod?.month || ''}/${payment.paymentPeriod?.year || ''}`,
    context: {
      grossAmount: amount,
      netAmount: amount,
      taxAmount: 0,
      payment
    },
    userId,
    auditModel: SalaryPayment
  });
}

async function getTrialBalance({ startDate, endDate }) {
  const filter = { status: 'posted' };
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  const entries = await JournalEntry.find(filter)
    .populate('lines.account', 'code name type normalBalance')
    .lean();

  const buckets = new Map();

  entries.forEach((entry) => {
    (entry.lines || []).forEach((line) => {
      if (!line.account) return;

      const key = String(line.account._id);
      if (!buckets.has(key)) {
        buckets.set(key, {
          accountId: line.account._id,
          code: line.account.code,
          name: line.account.name,
          type: line.account.type,
          debit: 0,
          credit: 0
        });
      }

      const bucket = buckets.get(key);
      bucket.debit += Number(line.debit || 0);
      bucket.credit += Number(line.credit || 0);
    });
  });

  const lines = Array.from(buckets.values())
    .map((item) => {
      const net = Number((item.debit - item.credit).toFixed(2));
      return {
        ...item,
        debitBalance: net > 0 ? net : 0,
        creditBalance: net < 0 ? Math.abs(net) : 0
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const totals = lines.reduce((sum, line) => {
    sum.debit += line.debitBalance;
    sum.credit += line.creditBalance;
    return sum;
  }, { debit: 0, credit: 0 });

  totals.debit = Number(totals.debit.toFixed(2));
  totals.credit = Number(totals.credit.toFixed(2));

  return { lines, totals, isBalanced: totals.debit === totals.credit };
}

async function getGeneralLedger(accountId, { startDate, endDate }) {
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    throw new Error('Invalid account ID');
  }

  const account = await Account.findById(accountId).lean();
  if (!account) throw new Error('Account not found');

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const openingFilter = {
    status: 'posted',
    'lines.account': account._id
  };
  if (startDate) {
    openingFilter.date = { $lt: new Date(startDate) };
  }

  const openingEntries = await JournalEntry.find(openingFilter).lean();
  let openingBalance = 0;
  openingEntries.forEach((entry) => {
    const lines = (entry.lines || []).filter((line) => String(line.account) === String(account._id));
    lines.forEach((line) => {
      openingBalance += (Number(line.debit || 0) - Number(line.credit || 0));
    });
  });

  const txFilter = {
    status: 'posted',
    'lines.account': account._id
  };
  if (Object.keys(dateFilter).length > 0) txFilter.date = dateFilter;

  const entries = await JournalEntry.find(txFilter)
    .sort({ date: 1, createdAt: 1 })
    .lean();

  let running = Number(openingBalance.toFixed(2));
  const transactions = [];

  entries.forEach((entry) => {
    const lines = (entry.lines || []).filter((line) => String(line.account) === String(account._id));
    lines.forEach((line) => {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      running = Number((running + debit - credit).toFixed(2));

      transactions.push({
        date: entry.date,
        entryNumber: entry.entryNumber,
        description: entry.description,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        lineDescription: line.description || '',
        debit,
        credit,
        runningBalance: running
      });
    });
  });

  return {
    account: {
      _id: account._id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance
    },
    openingBalance: Number(openingBalance.toFixed(2)),
    closingBalance: Number(running.toFixed(2)),
    transactions
  };
}

module.exports = {
  DEFAULT_CHART,
  DEFAULT_RULES,
  ensureDefaultChart,
  ensureDefaultRules,
  ensureOpenPeriod,
  setPeriodStatus,
  listPeriods,
  createJournalEntry,
  reverseJournalEntry,
  postCashRequestDisbursement,
  postSupplierInvoice,
  postCustomerInvoice,
  postSalaryPayment,
  getTrialBalance,
  getGeneralLedger
};
