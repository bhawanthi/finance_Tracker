const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  age: {
    type: Number,
    required: true
  },
  jobRole: {
    type: String,
    required: true
  },
  monthlySalary: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'CHF', 'MXN', 'BRL', 'ZAR', 'SGD', 'HKD', 'KRW', 'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'MYR', 'IDR', 'PHP', 'TRY', 'RUB', 'AED', 'SAR', 'EGP', 'NGN', 'KES', 'LKR']
  },
  password: {
    type: String,
    required: true
  },
  notificationSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    email: {
      type: String,
      default: ''
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    includeSalaryTips: {
      type: Boolean,
      default: true
    },
    includeGoals: {
      type: Boolean,
      default: true
    },
    includeBudgets: {
      type: Boolean,
      default: true
    },
    lastSent: {
      type: Date,
      default: null
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
