const mongoose = require('mongoose');

const estatePlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planName: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true,
    maxlength: [200, 'Plan name cannot exceed 200 characters']
  },
  planType: {
    type: String,
    enum: ['basic', 'comprehensive', 'trust_based', 'business_succession'],
    default: 'basic'
  },
  assets: [{
    type: {
      type: String,
      enum: ['real_estate', 'bank_account', 'investment', 'business', 'personal_property', 'insurance', 'retirement_account'],
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 500
    },
    estimatedValue: {
      type: Number,
      required: true,
      min: 0
    },
    location: String,
    accountNumber: String,
    beneficiaries: [{
      name: { type: String, required: true },
      relationship: String,
      percentage: { type: Number, min: 0, max: 100 },
      contingent: { type: Boolean, default: false }
    }]
  }],
  beneficiaries: [{
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    relationship: {
      type: String,
      required: true,
      enum: ['spouse', 'child', 'parent', 'sibling', 'friend', 'charity', 'other']
    },
    dateOfBirth: Date,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'United States' }
    },
    contactInfo: {
      phone: String,
      email: String
    },
    isPrimary: { type: Boolean, default: false },
    isContingent: { type: Boolean, default: false },
    percentage: { type: Number, min: 0, max: 100 }
  }],
  executor: {
    fullName: String,
    relationship: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'United States' }
    },
    contactInfo: {
      phone: String,
      email: String
    },
    alternateExecutor: {
      fullName: String,
      relationship: String,
      contactInfo: {
        phone: String,
        email: String
      }
    }
  },
  guardianship: {
    minorChildren: [{
      name: String,
      dateOfBirth: Date,
      guardian: {
        fullName: String,
        relationship: String,
        contactInfo: {
          phone: String,
          email: String
        }
      },
      alternateGuardian: {
        fullName: String,
        relationship: String,
        contactInfo: {
          phone: String,
          email: String
        }
      }
    }]
  },
  documents: [{
    type: {
      type: String,
      enum: ['will', 'trust', 'power_of_attorney', 'healthcare_directive', 'beneficiary_designation', 'other'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    url: String,
    dateCreated: { type: Date, default: Date.now },
    lastUpdated: Date,
    status: {
      type: String,
      enum: ['draft', 'executed', 'needs_update'],
      default: 'draft'
    }
  }],
  totalEstateValue: {
    type: Number,
    default: 0
  },
  estimatedTaxLiability: {
    type: Number,
    default: 0
  },
  lastReviewDate: Date,
  nextReviewDate: Date,
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'completed', 'needs_update'],
    default: 'draft'
  },
  notes: {
    type: String,
    maxlength: 2000
  },
  attorneyInfo: {
    name: String,
    firm: String,
    phone: String,
    email: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
estatePlanSchema.index({ userId: 1 });
estatePlanSchema.index({ status: 1 });
estatePlanSchema.index({ nextReviewDate: 1 });

// Virtual for calculating total asset value
estatePlanSchema.virtual('calculatedEstateValue').get(function() {
  return this.assets.reduce((total, asset) => total + (asset.estimatedValue || 0), 0);
});

// Pre-save middleware to update total estate value
estatePlanSchema.pre('save', function(next) {
  this.totalEstateValue = this.calculatedEstateValue;
  
  // Set next review date if not set (1 year from now)
  if (!this.nextReviewDate) {
    this.nextReviewDate = new Date();
    this.nextReviewDate.setFullYear(this.nextReviewDate.getFullYear() + 1);
  }
  
  next();
});

// Method to check if plan needs review
estatePlanSchema.methods.needsReview = function() {
  return this.nextReviewDate && this.nextReviewDate <= new Date();
};

// Static method to find plans needing review
estatePlanSchema.statics.findNeedingReview = function() {
  return this.find({
    nextReviewDate: { $lte: new Date() },
    status: { $ne: 'draft' }
  });
};

module.exports = mongoose.model('EstatePlan', estatePlanSchema);
