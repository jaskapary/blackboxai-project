const mongoose = require('mongoose');

const taxRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  taxYear: {
    type: Number,
    required: [true, 'Tax year is required'],
    min: [2000, 'Tax year must be 2000 or later'],
    max: [new Date().getFullYear() + 1, 'Tax year cannot be in the future']
  },
  filingStatus: {
    type: String,
    enum: ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household', 'qualifying_widow'],
    required: true
  },
  income: {
    wages: { type: Number, default: 0 },
    dividends: { type: Number, default: 0 },
    capitalGains: { type: Number, default: 0 },
    businessIncome: { type: Number, default: 0 },
    otherIncome: { type: Number, default: 0 }
  },
  deductions: {
    standardDeduction: { type: Number, default: 0 },
    itemizedDeductions: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 }
  },
  taxableIncome: {
    type: Number,
    default: 0
  },
  taxOwed: {
    type: Number,
    default: 0
  },
  taxPaid: {
    type: Number,
    default: 0
  },
  refundOrOwed: {
    type: Number,
    default: 0
  },
  filingDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'filed', 'processed', 'amended'],
    default: 'draft'
  },
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadDate: { type: Date, default: Date.now }
  }],
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Index for better query performance
taxRecordSchema.index({ userId: 1, taxYear: -1 });
taxRecordSchema.index({ status: 1 });

// Calculate total income
taxRecordSchema.virtual('totalIncome').get(function() {
  const income = this.income;
  return income.wages + income.dividends + income.capitalGains + income.businessIncome + income.otherIncome;
});

// Pre-save middleware to calculate taxable income
taxRecordSchema.pre('save', function(next) {
  this.taxableIncome = this.totalIncome - this.deductions.totalDeductions;
  this.refundOrOwed = this.taxPaid - this.taxOwed;
  next();
});

module.exports = mongoose.model('TaxRecord', taxRecordSchema);
