const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const { triggerTestNotification } = require('../services/schedulerService');

const getUserIdFromRequest = (req) => req.user?.id || req.user?.user?.id;
const toBoolean = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const normalizeFrequency = (value) => {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  const frequencyMap = {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
    'daily - every morning at 8 am': 'daily',
    'weekly - every monday at 8 am': 'weekly',
    'monthly - 1st of each month at 8 am': 'monthly'
  };

  return frequencyMap[normalized] || null;
};

// Auth middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Fix: use decoded directly
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Get notification settings
router.get('/settings', auth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    const user = await User.findById(userId).select('notificationSettings email');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // If notification email is not set, use user's email
    const notificationSettings = user.notificationSettings || {};
    if (!notificationSettings.email) {
      notificationSettings.email = user.email;
    }

    res.json(notificationSettings);
  } catch (err) {
    console.error('Error fetching notification settings:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update notification settings
router.put('/settings', auth, async (req, res) => {
  try {
    const {
      enabled,
      email,
      frequency,
      includeSalaryTips,
      includeGoals,
      includeBudgets
    } = req.body;

    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    const user = await User.findById(userId).select('notificationSettings email');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const normalizedFrequency = normalizeFrequency(frequency);

    // Validate frequency
    if (frequency && !normalizedFrequency) {
      return res.status(400).json({ msg: 'Invalid frequency. Must be daily, weekly, or monthly.' });
    }

    const existingSettings = user.notificationSettings || {};

    const updatedSettings = {
      enabled: toBoolean(enabled, existingSettings.enabled || false),
      email: (typeof email === 'string' && email.trim()) ? email.trim() : (existingSettings.email || user.email),
      frequency: normalizedFrequency || existingSettings.frequency || 'weekly',
      includeSalaryTips: toBoolean(includeSalaryTips, existingSettings.includeSalaryTips ?? true),
      includeGoals: toBoolean(includeGoals, existingSettings.includeGoals ?? true),
      includeBudgets: toBoolean(includeBudgets, existingSettings.includeBudgets ?? true),
      lastSent: existingSettings.lastSent || null
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { notificationSettings: updatedSettings } },
      { new: true, runValidators: true }
    ).select('notificationSettings');

    res.json({
      msg: 'Notification settings updated successfully',
      notificationSettings: updatedUser.notificationSettings
    });
  } catch (err) {
    console.error('Error updating notification settings:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Test notification endpoint - send test email
router.post('/test', auth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    const result = await triggerTestNotification(userId);
    
    if (result.success) {
      res.json({ msg: 'Test email sent successfully!', messageId: result.messageId });
    } else {
      res.status(400).json({ msg: result.message || 'Failed to send test email', error: result.error });
    }
  } catch (err) {
    console.error('Error sending test notification:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
