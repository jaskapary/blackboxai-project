const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Budget name is required'],
    trim: true,
    maxlength: [200, 'Budget name cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Budget category is required'],
    enum: [
      'housing', 'transportation', 'food', 'utilities', 'insurance',
      'healthcare', 'savings', 'debt_payments', 'entertainment',
      'personal_care', 'clothing', 'education', 'gifts_donations',
      'miscellaneous', 'investments', 'emergency_fund'
    ]
  },
  budgetedAmount: {
    type: Number,
    required: [true, 'Budgeted amount is required'],
    min: [0, 'Budgeted amount cannot be negative']
  },
  actualAmount: {
    type: Number,
    default: 0,
    min: [0, 'Actual amount cannot be negative']
  },
  period: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  year: {
    type: Number,
    required: true,
    min: [2000, 'Year must be 2000 or later']
  },
  month: {
    type: Number,
    min: [1, 'Month must be between 1 and 12'],
    max: [12, 'Month must be between 1 and 12']
  },
  week: {
    type: Number,
    min: [1, 'Week must be between 1 and 53'],
    max: [53, 'Week must be between 1 and 53']
  },
  quarter: {
    type: Number,
    min: [1, 'Quarter must be between 1 and 4'],
    max: [4, 'Quarter must be between 1 and 4']
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'exceeded'],
    default: 'active'
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  transactions: [{
    description: {
      type: String,
      required: true,
      maxlength: 200
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['expense', 'income'],
      default: 'expense'
    },
    category: String,
    notes: {
      type: String,
      maxlength: 300
    }
  }],
  alerts: {
    enabled: {
      type: Boolean,
      default: true
    },
    thresholds: {
      warning: {
        type: Number,
        min: 0,
        max: 100,
        default: 80
      },
      critical: {
        type: Number,
        min: 0,
        max: 100,
        default: 95
      }
    },
    lastAlertSent: Date
  },
  recurringSettings: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly']
    },
    endDate: Date,
    nextDueDate: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
budgetSchema.index({ userId: 1, year: -1, month: -1 });
budgetSchema.index({ userId: 1, category: 1 });
budgetSchema.index({ userId: 1, status: 1 });
budgetSchema.index({ 'recurringSettings.nextDueDate': 1 });

// Virtual for remaining amount
budgetSchema.virtual('remainingAmount').get(function() {
  return this.budgetedAmount - this.actualAmount;
});

// Virtual for percentage used
budgetSchema.virtual('percentageUsed').get(function() {
  if (this.budgetedAmount === 0) return 0;
  return Math.round((this.actualAmount / this.budgetedAmount) * 100);
});

// Virtual for budget status based on usage
budgetSchema.virtual('usageStatus').get(function() {
  const percentage = this.percentageUsed;
  if (percentage >= 100) return 'exceeded';
  if (percentage >= this.alerts.thresholds.critical) return 'critical';
  if (percentage >= this.alerts.thresholds.warning) return 'warning';
  return 'good';
});

// Virtual for total transaction amount
budgetSchema.virtual('totalTransactions').get(function() {
  return this.transactions.reduce((total, transaction) => {
    return transaction.type === 'expense' 
      ? total + transaction.amount 
      : total - transaction.amount;
  }, 0);
});

// Pre-save middleware to set period-specific fields
budgetSchema.pre('save', function(next) {
  const now = new Date();
  
  // Set default year if not provided
  if (!this.year) {
    this.year = now.getFullYear();
  }
  
  // Set period-specific fields based on period type
  if (this.period === 'monthly' && !this.month) {
    this.month = now.getMonth() + 1;
  } else if (this.period === 'quarterly' && !this.quarter) {
    this.quarter = Math.ceil((now.getMonth() + 1) / 3);
  } else if (this.period === 'weekly' && !this.week) {
    // Calculate week number
    const start = new Date(this.year, 0, 1);
    const diff = now - start;
    this.week = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  }
  
  // Update actual amount based on transactions
  this.actualAmount = this.totalTransactions;
  
  // Update status based on usage
  if (this.percentageUsed >= 100) {
    this.status = 'exceeded';
  } else if (this.status === 'exceeded' && this.percentageUsed < 100) {
    this.status = 'active';
  }
  
  // Set next due date for recurring budgets
  if (this.recurringSettings.isRecurring && !this.recurringSettings.nextDueDate) {
    const nextDue = new Date();
    switch (this.recurringSettings.frequency) {
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + 7);
        break;
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + 1);
        break;
      case 'quarterly':
        nextDue.setMonth(nextDue.getMonth() + 3);
        break;
      case 'yearly':
        nextDue.setFullYear(nextDue.getFullYear() + 1);
        break;
    }
    this.recurringSettings.nextDueDate = nextDue;
  }
  
  next();
});

// Method to add transaction
budgetSchema.methods.addTransaction = function(transactionData) {
  this.transactions.push(transactionData);
  return this.save();
};

// Method to check if alert should be sent
budgetSchema.methods.shouldSendAlert = function() {
  if (!this.alerts.enabled) return false;
  
  const percentage = this.percentageUsed;
  const lastAlert = this.alerts.lastAlertSent;
  const now = new Date();
  
  // Don't send alerts more than once per day
  if (lastAlert && (now - lastAlert) < 24 * 60 * 60 * 1000) {
    return false;
  }
  
  return percentage >= this.alerts.thresholds.warning;
};

// Static method to find budgets needing alerts
budgetSchema.statics.findNeedingAlerts = function() {
  return this.find({
    'alerts.enabled': true,
    status: 'active'
  }).where('actualAmount').gte(0);
};

// Static method to find overdue recurring budgets
budgetSchema.statics.findOverdueRecurring = function() {
  return this.find({
    'recurringSettings.isRecurring': true,
    'recurringSettings.nextDueDate': { $lte: new Date() }
  });
};

module.exports = mongoose.model('Budget', budgetSchema);
