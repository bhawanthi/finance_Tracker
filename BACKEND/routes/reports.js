const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');  
const User = require('../models/User');

// Helper functions
const getRandomColor = () => {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#84cc16'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const formatCurrency = (amount) => {
  return `LKR ${Math.round(amount).toLocaleString()}`;
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// GET /api/reports/analytics - Comprehensive financial analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const userId = req.user.id;
    
    console.log(`Generating analytics for user: ${userId}, period: ${dateRange}`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '12m':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    console.log('Date range:', { startDate, endDate });

    // First try to fetch user data
    const user = await User.findById(userId);
    console.log('User found:', user ? user.name : 'Not found');

    // Fetch transactions with error handling
    let transactions = [];
    try {
      transactions = await Transaction.find({ 
        userId: userId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 });
      console.log('Transactions found:', transactions.length);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }

    // Fetch budgets with error handling
    let budgets = [];
    try {
      budgets = await Budget.find({ userId: userId });
      console.log('Budgets found:', budgets.length);
    } catch (err) {
      console.error('Error fetching budgets:', err);
    }

    // Fetch goals with error handling
    let goals = [];
    try {
      goals = await Goal.find({ userId: userId });
      console.log('Goals found:', goals.length);
    } catch (err) {
      console.error('Error fetching goals:', err);
    }

    // Calculate financial summary
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    console.log('Financial summary calculated:', { totalIncome, totalExpenses, netSavings });

    // Monthly trends analysis (simplified for debugging)
    const monthlyTrends = [];
    try {
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i, 1);
        monthStart.setHours(0, 0, 0, 0);
        
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthStart.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const monthTransactions = transactions.filter(t => 
          t.date && t.date >= monthStart && t.date <= monthEnd
        );

        const monthIncome = monthTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        const monthExpenses = monthTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        monthlyTrends.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          income: monthIncome,
          expenses: monthExpenses,
          savings: monthIncome - monthExpenses
        });
      }
      console.log('Monthly trends calculated:', monthlyTrends.length, 'months');
    } catch (err) {
      console.error('Error calculating monthly trends:', err);
    }

    // Category spending analysis
    let categoryBreakdown = [];
    try {
      const categoryMap = {};
      transactions
        .filter(t => t.type === 'expense' && t.category && t.amount)
        .forEach(t => {
          if (!categoryMap[t.category]) {
            categoryMap[t.category] = 0;
          }
          categoryMap[t.category] += t.amount;
        });

      categoryBreakdown = Object.entries(categoryMap)
        .map(([category, amount]) => ({
          category,
          name: category, // Add name field for frontend compatibility
          amount,
          percentage: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0,
          color: getRandomColor()
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      console.log('Category breakdown calculated:', categoryBreakdown.length, 'categories');
    } catch (err) {
      console.error('Error calculating category breakdown:', err);
    }

    // Budget performance analysis
    const budgetPerformance = [];
    
    console.log('Processing budgets for performance:', budgets.length, 'budgets found');
    console.log('Budget sample:', budgets[0] ? JSON.stringify(budgets[0], null, 2) : 'No budgets');
    
    // Process each budget and its categories
    budgets.forEach(budget => {
      console.log('Processing budget:', budget.name, 'with categories:', budget.categories?.length || 0);
      
      if (budget.categories && budget.categories.length > 0) {
        budget.categories.forEach(categoryBudget => {
          const spent = transactions
            .filter(t => t.type === 'expense' && t.category === categoryBudget.category)
            .reduce((sum, t) => sum + t.amount, 0);
          
          const budgeted = categoryBudget.budgetedAmount || 0;
          const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
          
          console.log(`Category ${categoryBudget.category}: budgeted=${budgeted}, spent=${spent}, percentage=${percentage}`);
          
          budgetPerformance.push({
            category: categoryBudget.category,
            budgeted: budgeted,
            spent: spent,
            remaining: budgeted - spent,
            percentage: Number(percentage.toFixed(1)),
            status: percentage <= 100 ? 'under' : 'over'
          });
        });
      } else {
        // If no categories, create a default entry for the budget
        const spent = transactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const budgeted = budget.totalBudget || 0;
        const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
        
        console.log(`Total budget: budgeted=${budgeted}, spent=${spent}, percentage=${percentage}`);
        
        budgetPerformance.push({
          category: budget.name || 'Total Budget',
          budgeted: budgeted,
          spent: spent,
          remaining: budgeted - spent,
          percentage: Number(percentage.toFixed(1)),
          status: percentage <= 100 ? 'under' : 'over'
        });
      }
    });
    
    console.log('Budget performance calculated:', budgetPerformance.length, 'items');
    
    // If no budget performance data, create a sample entry to show the user what it would look like
    if (budgetPerformance.length === 0 && transactions.length > 0) {
      // Calculate total expenses by category
      const expensesByCategory = {};
      transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const category = t.category || 'Uncategorized';
          expensesByCategory[category] = (expensesByCategory[category] || 0) + t.amount;
        });

      // Create budget performance entries for categories with expenses
      Object.entries(expensesByCategory).forEach(([category, spent]) => {
        budgetPerformance.push({
          category: category,
          budgeted: 0,
          spent: spent,
          remaining: -spent,
          percentage: 100, // Show as 100% to indicate spending without budget
          status: 'no-budget'
        });
      });
    }

    // Financial insights generation
    const insights = [];

    // Savings rate insight
    if (savingsRate >= 20) {
      insights.push({
        type: 'positive',
        title: 'Excellent Savings Rate! 🎉',
        description: `You're saving ${savingsRate.toFixed(1)}% of your income, which exceeds the recommended 20%. Keep up the great work!`,
        icon: '💰',
        priority: 'high'
      });
    } else if (savingsRate >= 10) {
      insights.push({
        type: 'info',
        title: 'Good Savings Progress 📈',
        description: `You're saving ${savingsRate.toFixed(1)}% of your income. Try to reach the recommended 20% savings rate.`,
        icon: '💡',
        priority: 'medium'
      });
    } else if (savingsRate >= 0) {
      insights.push({
        type: 'warning',
        title: 'Improve Your Savings ⚠️',
        description: `Your savings rate is ${savingsRate.toFixed(1)}%. Consider reducing expenses or increasing income to save more.`,
        icon: '📊',
        priority: 'high'
      });
    } else {
      insights.push({
        type: 'error',
        title: 'Spending More Than Earning! 🚨',
        description: `You're spending ${Math.abs(savingsRate).toFixed(1)}% more than you earn. Immediate budget review needed.`,
        icon: '⚠️',
        priority: 'critical'
      });
    }

    // Category spending insights
    if (categoryBreakdown.length > 0) {
      const topCategory = categoryBreakdown[0];
      if (topCategory.percentage > 40) {
        insights.push({
          type: 'warning',
          title: `High ${topCategory.category} Spending 🔍`,
          description: `${topCategory.category} accounts for ${topCategory.percentage}% of your expenses. Consider reviewing this category.`,
          icon: '📊',
          priority: 'medium'
        });
      }
    }

    // Budget performance insights
    const overBudgetCategories = budgetPerformance.filter(b => b.status === 'over');
    if (overBudgetCategories.length > 0) {
      const totalOverBudget = overBudgetCategories.reduce((sum, b) => sum + Math.abs(b.remaining), 0);
      insights.push({
        type: 'warning',
        title: `${overBudgetCategories.length} Budget(s) Exceeded 📈`,
        description: `You're over budget by ${formatCurrency(totalOverBudget)} across ${overBudgetCategories.length} categories.`,
        icon: '💸',
        priority: 'high'
      });
    }

    // Transaction volume insight
    if (transactions.length > 100) {
      insights.push({
        type: 'info',
        title: 'Active Financial Life 📱',
        description: `You have ${transactions.length} transactions this period. Your financial activity is well documented!`,
        icon: '📊',
        priority: 'low'
      });
    }

    // Income growth insight (if we have previous data)
    if (monthlyTrends.length >= 2) {
      const currentMonth = monthlyTrends[monthlyTrends.length - 1];
      const previousMonth = monthlyTrends[monthlyTrends.length - 2];
      const incomeGrowth = ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100;
      
      if (incomeGrowth > 5) {
        insights.push({
          type: 'positive',
          title: 'Income Growth Detected! 📈',
          description: `Your income increased by ${incomeGrowth.toFixed(1)}% compared to last month. Great progress!`,
          icon: '💰',
          priority: 'medium'
        });
      } else if (incomeGrowth < -5) {
        insights.push({
          type: 'warning',
          title: 'Income Decrease Noticed 📉',
          description: `Your income decreased by ${Math.abs(incomeGrowth).toFixed(1)}% compared to last month. Monitor this trend.`,
          icon: '⚠️',
          priority: 'medium'
        });
      }
    }

    // Add helper function for currency formatting
    function formatCurrency(amount) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }

    // Sort insights by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    insights.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));

    if (insights.length < 3) {
      insights.push({
        type: 'info',
        title: 'Good Savings Habit',
        description: `You're saving ${savingsRate.toFixed(1)}% of your income. Consider increasing to 20% for better financial security.`
      });
    } else if (savingsRate > 0) {
      insights.push({
        type: 'warning',
        title: 'Low Savings Rate',
        description: `You're only saving ${savingsRate.toFixed(1)}% of your income. Try to increase savings to at least 10-20%.`
      });
    } else {
      insights.push({
        type: 'alert',
        title: 'Negative Savings',
        description: 'You are spending more than you earn. Consider reviewing your expenses and creating a budget.'
      });
    }

    // Top spending category insight
    if (categoryBreakdown.length > 0) {
      const topCategory = categoryBreakdown[0];
      insights.push({
        type: 'info',
        title: `Top Expense: ${topCategory.category}`,
        description: `${topCategory.category} accounts for ${topCategory.percentage}% of your total expenses ($${topCategory.amount.toFixed(2)}).`
      });
    }

    // Budget alerts
    const overspendingCategories = budgetPerformance.filter(b => b.status === 'over');
    if (overspendingCategories.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Budget Overspend Alert',
        description: `You're over budget in ${overspendingCategories.length} categories: ${overspendingCategories.map(b => b.category).join(', ')}.`,
        icon: '⚠️',
        priority: 'high'
      });
    }

    // Goals progress insight
    const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount);
    if (activeGoals.length > 0) {
      const totalGoalProgress = activeGoals.reduce((sum, g) => sum + (g.currentAmount / g.targetAmount), 0) / activeGoals.length * 100;
      insights.push({
        type: 'info',
        title: 'Goals Progress',
        description: `You have ${activeGoals.length} active goals with an average progress of ${totalGoalProgress.toFixed(1)}%.`
      });
    }

    console.log('Preparing response data...');

    // Response data
    const analyticsData = {
      summary: {
        totalIncome: totalIncome || 0,
        totalExpenses: totalExpenses || 0,
        netSavings: netSavings || 0,
        savingsRate: (savingsRate || 0).toFixed(1),
        transactionCount: transactions.length || 0,
        period: dateRange
      },
      monthlyTrends: monthlyTrends || [],
      categoryBreakdown: categoryBreakdown || [],
      budgetPerformance: budgetPerformance || [],
      insights: insights || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        userId: userId,
        userName: user?.name || 'User',
        period: dateRange
      }
    };

    console.log('Sending response with data:', {
      summaryKeys: Object.keys(analyticsData.summary),
      monthlyTrendsCount: analyticsData.monthlyTrends.length,
      categoryCount: analyticsData.categoryBreakdown.length,
      insightsCount: analyticsData.insights.length
    });

    res.json(analyticsData);

  } catch (error) {
    console.error('Error generating analytics:', error);
    console.error('Error stack:', error.stack);
    
    // Ensure we always send a response
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Error generating financial analytics',
        error: error.message,
        summary: {
          totalIncome: 0,
          totalExpenses: 0,
          netSavings: 0,
          savingsRate: '0.0',
          transactionCount: 0,
          period: '30d'
        },
        monthlyTrends: [],
        categoryBreakdown: [],
        budgetPerformance: [],
        insights: [{
          type: 'error',
          title: 'Data Loading Error',
          description: 'Unable to load your financial data. Please try again.'
        }],
        metadata: {
          generatedAt: new Date().toISOString(),
          userId: req.user?.id || 'unknown',
          userName: 'User',
          period: '30d'
        }
      });
    }
  }
});

// Helper function to get period label
const getPeriodLabel = (dateRange) => {
  switch (dateRange) {
    case '7d': return 'Last 7 Days';
    case '30d': return 'Last 30 Days';
    case '90d': return 'Last 90 Days';
    case '12m': return 'Last 12 Months';
    default: return 'Last 30 Days';
  }
};

// GET /api/reports/pdf - Generate PDF report
router.get('/pdf', authenticateToken, async (req, res) => {
  try {
    console.log('PDF generation requested by user:', req.user.id);
    const { period = '30d' } = req.query;
    const userId = req.user.id;
    
    // Get data for the specified period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '12m':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    console.log('Fetching data for PDF generation...');
    const [transactions, budgets, user] = await Promise.all([
      Transaction.find({ 
        userId: userId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 }),
      Budget.find({ userId: userId }),
      User.findById(userId)
    ]);

    console.log(`Found ${transactions.length} transactions, ${budgets.length} budgets for PDF`);

    // Validate user exists
    if (!user) {
      console.error('User not found for PDF generation');
      return res.status(404).json({ message: 'User not found' });
    }

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const netSavings = totalIncome - totalExpenses;

    console.log('PDF data calculated:', { totalIncome, totalExpenses, netSavings });

    // Create PDF document
    const doc = new PDFDocument({ 
      margin: 40,
      size: 'LETTER',
      bufferPages: true
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="MONIVUE-Financial-Report-${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    try {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);
      
      // ==================== HEADER ====================
      // Gradient header background
      doc.rect(0, 0, pageWidth, 140).fill('#1e3c72');
      doc.rect(0, 0, pageWidth, 140).fillOpacity(0.1).fill('#2a5298');
      doc.fillOpacity(1);
      
      // Add Logo Image
      const logoPath = path.join(__dirname, '../../frontend/src/assets/Finance_Logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 40, { width: 60, height: 60 });
      }
      
      // Company Name and Title
      doc.fontSize(32).fillColor('#ffffff').font('Helvetica-Bold').text('MONIVUE', 130, 45);
      doc.fontSize(14).fillColor('#e8f4f8').font('Helvetica').text('Financial Report', 130, 80);
      doc.fontSize(10).fillColor('#b8d4f1').text('Track. Save. Grow.', 130, 100);
      
      // Info box on right side
      const infoX = pageWidth - 220;
      doc.roundedRect(infoX, 30, 180, 80, 5).lineWidth(1.5).strokeOpacity(0.3).stroke('#ffffff');
      
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('REPORT DETAILS', infoX + 15, 40, { width: 150 });
      
      doc.fontSize(8).fillColor('#e8f4f8').font('Helvetica');
      doc.text('Generated:', infoX + 15, 58);
      doc.text(new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }), infoX + 70, 58);
      
      doc.text('Period:', infoX + 15, 72);
      doc.text(getPeriodLabel(period), infoX + 70, 72);
      
      doc.text('User:', infoX + 15, 86);
      doc.text(user.name || 'User', infoX + 70, 86, { width: 95 });
      
      // ==================== SUMMARY SECTION ====================
      let yPos = 170;
      
      // Section title with underline
      doc.fontSize(18).fillColor('#1e3c72').font('Helvetica-Bold');
      doc.text('Financial Summary', margin, yPos);
      doc.moveTo(margin, yPos + 22).lineTo(pageWidth - margin, yPos + 22).lineWidth(2).strokeOpacity(0.3).stroke('#1e3c72');
      yPos += 40;
      
      // Three metric cards
      const cardWidth = (contentWidth - 40) / 3;
      const cardHeight = 75;
      const cardGap = 20;
      
      // Income Card
      const card1X = margin;
      doc.roundedRect(card1X, yPos, cardWidth, cardHeight, 8).fill('#e6f7ff');
      doc.roundedRect(card1X, yPos, cardWidth, cardHeight, 8).lineWidth(2).stroke('#40a9ff');
      doc.fontSize(11).fillColor('#0050b3').font('Helvetica-Bold').text('TOTAL INCOME', card1X + 15, yPos + 15, { width: cardWidth - 30 });
      doc.fontSize(24).fillColor('#0050b3').font('Helvetica-Bold').text(`$${totalIncome.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, card1X + 15, yPos + 40, { width: cardWidth - 30 });
      
      // Expenses Card
      const card2X = card1X + cardWidth + cardGap;
      doc.roundedRect(card2X, yPos, cardWidth, cardHeight, 8).fill('#fff2e6');
      doc.roundedRect(card2X, yPos, cardWidth, cardHeight, 8).lineWidth(2).stroke('#ff7a45');
      doc.fontSize(11).fillColor('#d46b08').font('Helvetica-Bold').text('TOTAL EXPENSES', card2X + 15, yPos + 15, { width: cardWidth - 30 });
      doc.fontSize(24).fillColor('#d46b08').font('Helvetica-Bold').text(`$${totalExpenses.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, card2X + 15, yPos + 40, { width: cardWidth - 30 });
      
      // Savings Card
      const card3X = card2X + cardWidth + cardGap;
      const savingsColor = netSavings >= 0 ? '#52c41a' : '#ff4d4f';
      const savingsBg = netSavings >= 0 ? '#f6ffed' : '#fff2f0';
      doc.roundedRect(card3X, yPos, cardWidth, cardHeight, 8).fill(savingsBg);
      doc.roundedRect(card3X, yPos, cardWidth, cardHeight, 8).lineWidth(2).stroke(savingsColor);
      doc.fontSize(11).fillColor(savingsColor).font('Helvetica-Bold').text('NET SAVINGS', card3X + 15, yPos + 15, { width: cardWidth - 30 });
      doc.fontSize(24).fillColor(savingsColor).font('Helvetica-Bold').text(`$${netSavings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, card3X + 15, yPos + 40, { width: cardWidth - 30 });
      
      yPos += cardHeight + 40;

      // ==================== CATEGORY BREAKDOWN ====================
      const categoryMap = {};
      transactions.filter(t => t.type === 'expense' && t.category && t.amount).forEach(t => {
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
      });

      const topCategories = Object.entries(categoryMap)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

      if (topCategories.length > 0) {
        // Section title
        doc.fontSize(18).fillColor('#1e3c72').font('Helvetica-Bold').text('Expense Breakdown by Category', margin, yPos);
        doc.moveTo(margin, yPos + 22).lineTo(pageWidth - margin, yPos + 22).lineWidth(2).strokeOpacity(0.3).stroke('#1e3c72');
        yPos += 40;

        // Table header
        doc.roundedRect(margin, yPos, contentWidth, 30, 5).fill('#f5f7fa');
        doc.fontSize(11).fillColor('#1e3c72').font('Helvetica-Bold');
        doc.text('CATEGORY', margin + 20, yPos + 10, { width: 180 });
        doc.text('AMOUNT', margin + 210, yPos + 10, { width: 100 });
        doc.text('PERCENTAGE', margin + 320, yPos + 10, { width: 80 });
        doc.text('CHART', margin + 410, yPos + 10, { width: 100 });
        yPos += 35;

        topCategories.forEach(([category, amount], index) => {
          const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100) : 0;
          
          // Row background
          if (index % 2 === 0) {
            doc.rect(margin, yPos - 5, contentWidth, 28).fill('#fafbfc');
          }
          
          // Category name
          doc.fontSize(10).fillColor('#333333').font('Helvetica');
          doc.text(category || 'Unknown', margin + 20, yPos + 5, { width: 180 });
          
          // Amount
          doc.fontSize(10).fillColor('#d46b08').font('Helvetica-Bold');
          doc.text(`$${amount.toLocaleString('en-US', {minimumFractionDigits: 2})}`, margin + 210, yPos + 5, { width: 100 });
          
          // Percentage
          doc.fontSize(10).fillColor('#666666').font('Helvetica');
          doc.text(`${percentage.toFixed(1)}%`, margin + 320, yPos + 5, { width: 80 });
          
          // Progress bar
          const maxBarWidth = 120;
          const barWidth = Math.max(3, (percentage / 100) * maxBarWidth);
          doc.roundedRect(margin + 410, yPos + 6, maxBarWidth, 12, 3).fill('#e6f7ff');
          doc.roundedRect(margin + 410, yPos + 6, barWidth, 12, 3).fill('#40a9ff');
          
          yPos += 28;
        });
        yPos += 30;
      }

      // ==================== BUDGET PERFORMANCE ====================
      if (budgets.length > 0) {
        // Check if we need a new page
        if (yPos > pageHeight - 250) {
          doc.addPage();
          yPos = 60;
        }
        
        // Section title
        doc.fontSize(18).fillColor('#1e3c72').font('Helvetica-Bold').text('Budget Performance', margin, yPos);
        doc.moveTo(margin, yPos + 22).lineTo(pageWidth - margin, yPos + 22).lineWidth(2).strokeOpacity(0.3).stroke('#1e3c72');
        yPos += 40;

        budgets.slice(0, 6).forEach(budget => {
          let spent = 0;
          let budgeted = 0;
          let categoryName = 'Unknown Category';
          
          if (budget.categories && budget.categories.length > 0) {
            const firstCategory = budget.categories[0];
            categoryName = firstCategory.category;
            budgeted = firstCategory.budgetedAmount || 0;
            spent = transactions
              .filter(t => t.type === 'expense' && t.category === firstCategory.category)
              .reduce((sum, t) => sum + (t.amount || 0), 0);
          } else {
            categoryName = budget.name || 'Total Budget';
            budgeted = budget.totalBudget || 0;
            spent = transactions
              .filter(t => t.type === 'expense')
              .reduce((sum, t) => sum + (t.amount || 0), 0);
          }
          
          const percentage = budgeted > 0 ? (spent / budgeted * 100) : 0;
          const status = percentage <= 80 ? 'On Track' : percentage <= 100 ? 'Near Limit' : 'Over Budget';
          const statusColor = percentage <= 80 ? '#52c41a' : percentage <= 100 ? '#faad14' : '#ff4d4f';
          const statusBg = percentage <= 80 ? '#f6ffed' : percentage <= 100 ? '#fffbe6' : '#fff2f0';
          
          // Budget card
          doc.roundedRect(margin, yPos, contentWidth, 65, 8).fill('#ffffff');
          doc.roundedRect(margin, yPos, contentWidth, 65, 8).lineWidth(1).stroke('#e8e8e8');
          
          // Category name
          doc.fontSize(12).fillColor('#1e3c72').font('Helvetica-Bold').text(categoryName, margin + 20, yPos + 12);
          
          // Budget amounts in a row
          doc.fontSize(10).fillColor('#666666').font('Helvetica');
          doc.text('Budgeted:', margin + 20, yPos + 32);
          doc.fillColor('#0050b3').font('Helvetica-Bold').text(`$${budgeted.toLocaleString('en-US', {minimumFractionDigits: 2})}`, margin + 90, yPos + 32);
          
          doc.fillColor('#666666').font('Helvetica').text('Spent:', margin + 200, yPos + 32);
          doc.fillColor('#d46b08').font('Helvetica-Bold').text(`$${spent.toLocaleString('en-US', {minimumFractionDigits: 2})}`, margin + 250, yPos + 32);
          
          // Status badge
          const badgeX = pageWidth - margin - 120;
          doc.roundedRect(badgeX, yPos + 10, 100, 22, 4).fill(statusBg);
          doc.roundedRect(badgeX, yPos + 10, 100, 22, 4).lineWidth(1).stroke(statusColor);
          doc.fontSize(9).fillColor(statusColor).font('Helvetica-Bold').text(status, badgeX, yPos + 16, { width: 100, align: 'center' });
          
          // Progress bar
          const progressBarWidth = contentWidth - 40;
          const filledWidth = Math.min(progressBarWidth, (percentage / 100) * progressBarWidth);
          doc.roundedRect(margin + 20, yPos + 48, progressBarWidth, 10, 3).fill('#f0f2f5');
          
          // Color gradient based on percentage
          let barColor = '#52c41a';
          if (percentage > 100) barColor = '#ff4d4f';
          else if (percentage > 80) barColor = '#faad14';
          
          doc.roundedRect(margin + 20, yPos + 48, filledWidth, 10, 3).fill(barColor);
          
          // Percentage text on bar
          doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold');
          if (filledWidth > 30) {
            doc.text(`${percentage.toFixed(0)}%`, margin + 20, yPos + 50, { width: filledWidth, align: 'center' });
          }
          
          yPos += 75;
        });
        yPos += 20;
      }

      // ==================== FOOTER ====================
      // Add professional footer on each page
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Footer background
        doc.rect(0, pageHeight - 60, pageWidth, 60).fill('#f8f9fa');
        doc.moveTo(0, pageHeight - 60).lineTo(pageWidth, pageHeight - 60).lineWidth(1).strokeOpacity(0.2).stroke('#1e3c72');
        
        // Footer content
        doc.fontSize(8).fillColor('#666666').font('Helvetica');
        doc.text('MONIVUE Financial Tracker - Confidential Report', margin, pageHeight - 45);
        doc.text(`Report ID: MV-${Date.now()}`, margin, pageHeight - 30);
        
        doc.text(`Page ${i + 1} of ${range.count}`, pageWidth - margin - 80, pageHeight - 45, { width: 80, align: 'right' });
        doc.text(new Date().toLocaleDateString('en-US'), pageWidth - margin - 80, pageHeight - 30, { width: 80, align: 'right' });
      }

      // End the document
      doc.end();
      console.log('PDF generation completed successfully');

    } catch (pdfError) {
      console.error('Error during PDF creation:', pdfError);
      doc.end();
      throw pdfError;
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating PDF report', error: error.message });
    }
  }
});

// GET /api/reports/excel - Generate Excel report
router.get('/excel', authenticateToken, async (req, res) => {
  try {
    console.log('Excel generation requested by user:', req.user.id);
    const { period = '30d' } = req.query;
    const dateRange = period;
    const userId = req.user.id;
    
    // Get data for the specified period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '12m':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const [transactions, budgets, goals, user] = await Promise.all([
      Transaction.find({ 
        userId: userId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 }),
      Budget.find({ userId: userId }),
      Goal.find({ userId: userId }),
      User.findById(userId)
    ]);

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MONIVUE Finance Tracker';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Financial Summary');
    summarySheet.addRow(['MONIVUE Financial Report']);
    summarySheet.addRow(['Generated:', new Date().toLocaleDateString()]);
    summarySheet.addRow(['Period:', getPeriodLabel(period)]);
    summarySheet.addRow(['User:', user?.name || 'User']);
    summarySheet.addRow([]);
    
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Income', totalIncome]);
    summarySheet.addRow(['Total Expenses', totalExpenses]);
    summarySheet.addRow(['Net Savings', totalIncome - totalExpenses]);
    summarySheet.addRow(['Total Transactions', transactions.length]);

    // Transactions Sheet
    const transactionsSheet = workbook.addWorksheet('Transactions');
    transactionsSheet.addRow(['Date', 'Description', 'Category', 'Type', 'Amount']);
    
    transactions.forEach(transaction => {
      transactionsSheet.addRow([
        transaction.date.toLocaleDateString(),
        transaction.description,
        transaction.category,
        transaction.type,
        transaction.amount
      ]);
    });

    // Category Analysis Sheet
    const categoryMap = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });

    const categoriesSheet = workbook.addWorksheet('Expense Categories');
    categoriesSheet.addRow(['Category', 'Amount', 'Percentage']);
    Object.entries(categoryMap)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, amount]) => {
        const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0;
        categoriesSheet.addRow([category, amount, `${percentage}%`]);
      });

    // Budget Performance Sheet
    if (budgets.length > 0) {
      const budgetSheet = workbook.addWorksheet('Budget Performance');
      budgetSheet.addRow(['Category', 'Budgeted', 'Spent', 'Remaining', 'Status']);
      
      budgets.forEach(budget => {
        const spent = transactions
          .filter(t => t.type === 'expense' && t.category === budget.category)
          .reduce((sum, t) => sum + t.amount, 0);
        
        const remaining = budget.amount - spent;
        const status = remaining >= 0 ? 'On Track' : 'Over Budget';
        
        budgetSheet.addRow([
          budget.category, 
          budget.amount, 
          spent, 
          remaining, 
          status
        ]);
      });
    }

    // Goals Sheet
    if (goals.length > 0) {
      const goalsSheet = workbook.addWorksheet('Goals');
      goalsSheet.addRow(['Goal Name', 'Target Amount', 'Current Amount', 'Progress %', 'Status']);
      
      goals.forEach(goal => {
        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount * 100).toFixed(1) : 0;
        const status = goal.currentAmount >= goal.targetAmount ? 'Completed' : 'In Progress';
        
        goalsSheet.addRow([
          goal.name,
          goal.targetAmount,
          goal.currentAmount,
          `${progress}%`,
          status
        ]);
      });
    }

    // Style headers
    workbook.worksheets.forEach(sheet => {
      if (sheet.getRow(1).cellCount > 0) {
        sheet.getRow(1).font = { bold: true };
      }
      sheet.columns.forEach(column => {
        column.width = 20;
      });
    });

    // Generate buffer and send
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="MONIVUE-Report-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
    
    console.log('Excel report generated successfully');

  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ message: 'Error generating Excel report' });
  }
});

// GET /api/reports/investment-predictions - AI Investment Recommendations
router.get('/investment-predictions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`Generating investment predictions for user: ${userId}`);

    // Calculate user's financial profile based on last 90 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 90);

    const transactions = await Transaction.find({ 
      userId: userId,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate monthly income and expenses
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const monthlyIncome = totalIncome / 3; // Average over 90 days
    const monthlyExpenses = totalExpenses / 3;
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? ((monthlySavings / monthlyIncome) * 100).toFixed(1) : 0;

    // Determine risk profile based on savings rate
    let riskProfile = 'Moderate';
    if (savingsRate >= 30) {
      riskProfile = 'Aggressive';
    } else if (savingsRate < 15) {
      riskProfile = 'Conservative';
    }

    // Sri Lanka Investment Opportunities
    const sriLankaInvestments = [
      {
        name: 'NSB Savings Account',
        icon: '🏦',
        risk: 'Low',
        description: 'National Savings Bank offers one of the highest savings account interest rates in Sri Lanka with government backing and deposit insurance.',
        expectedReturn: '8-10% p.a.',
        minInvestment: 'LKR 100',
        timeHorizon: 'Short-term (Anytime)',
        features: [
          'Government guaranteed deposits',
          'Easy access to funds',
          'No lock-in period',
          'Interest paid monthly',
          'Available at all NSB branches'
        ]
      },
      {
        name: 'Fixed Deposits (Sri Lankan Banks)',
        icon: '💰',
        risk: 'Low',
        description: 'Fixed deposits with commercial banks like Bank of Ceylon, People\'s Bank, or Commercial Bank offering secure returns with guaranteed interest.',
        expectedReturn: '10-15% p.a.',
        minInvestment: 'LKR 10,000',
        timeHorizon: 'Medium-term (3-12 months)',
        features: [
          'Fixed guaranteed returns',
          'CBSL deposit insurance up to LKR 1.1M',
          'Flexible tenure options',
          'Higher rates for senior citizens',
          'Loan facilities against FD'
        ]
      },
      {
        name: 'Sri Lanka Government Treasury Bills',
        icon: '📜',
        risk: 'Low',
        description: 'Short-term government securities issued by Central Bank of Sri Lanka. Considered the safest investment with sovereign guarantee.',
        expectedReturn: '12-18% p.a.',
        minInvestment: 'LKR 100,000',
        timeHorizon: 'Short-term (91-364 days)',
        features: [
          'Government backed - zero default risk',
          'Tax-free interest income',
          'Tradable in secondary market',
          'Available through primary dealers',
          'Better returns than savings accounts'
        ]
      },
      {
        name: 'Unit Trusts / Mutual Funds (Sri Lanka)',
        icon: '📊',
        risk: 'Moderate',
        description: 'Professionally managed funds investing in stocks, bonds, and money market instruments. Options include equity funds, balanced funds, and money market funds.',
        expectedReturn: '12-25% p.a.',
        minInvestment: 'LKR 5,000',
        timeHorizon: 'Medium to Long-term (1-5 years)',
        features: [
          'Professional fund management',
          'Diversification across assets',
          'Regulated by SEC Sri Lanka',
          'Easy entry and exit',
          'Options: equity, debt, balanced funds'
        ]
      },
      {
        name: 'Colombo Stock Exchange (CSE)',
        icon: '📈',
        risk: 'High',
        description: 'Invest in blue-chip companies listed on CSE like JKH, Dialog, CTC, and Commercial Bank. Suitable for long-term wealth creation.',
        expectedReturn: '15-30% p.a.',
        minInvestment: 'LKR 10,000',
        timeHorizon: 'Long-term (3+ years)',
        features: [
          'Ownership in leading companies',
          'Dividend income potential',
          'Capital appreciation opportunities',
          'Online trading platforms available',
          'Regulated by SEC Sri Lanka'
        ]
      },
      {
        name: 'EPF Voluntary Contributions',
        icon: '🏛️',
        risk: 'Low',
        description: 'Employees\' Provident Fund accepts voluntary contributions beyond mandatory deductions. Excellent long-term savings with tax benefits.',
        expectedReturn: '9-11% p.a.',
        minInvestment: 'Any amount',
        timeHorizon: 'Long-term (Until retirement)',
        features: [
          'Government managed fund',
          'Tax deductible contributions',
          'Compound interest growth',
          'Secure retirement savings',
          'Employer matching (if employed)'
        ]
      }
    ];

    // International Investment Opportunities with detailed buying/selling tips
    const internationalInvestments = [
      {
        name: 'US Stock Market ETFs (S&P 500, NASDAQ)',
        icon: '🇺🇸',
        risk: 'Moderate',
        description: 'Exchange-traded funds tracking S&P 500 (VOO, SPY), NASDAQ-100 (QQQ), or total US market (VTI). Access through Interactive Brokers, TD Ameritrade, or Schwab.',
        expectedReturn: '8-12% p.a. (Historical average)',
        minInvestment: '$100 USD (~LKR 32,000)',
        timeHorizon: 'Long-term (5+ years)',
        features: [
          'Exposure to top US companies (Apple, Microsoft, Amazon)',
          'Diversification across 500+ companies',
          'Low expense ratios (0.03-0.20% annually)',
          'Dividend reinvestment available',
          'Highly liquid - buy/sell anytime during market hours'
        ],
        buyingTips: [
          'Open account with Interactive Brokers or TD Ameritrade (accepts Sri Lankan residents)',
          'Use Dollar Cost Averaging - invest fixed amount monthly regardless of price',
          'Buy during market dips (10%+ corrections) for better entry points',
          'Start with broad market ETFs like VOO or VTI before individual stocks',
          'Consider fractional shares to start with smaller amounts'
        ],
        sellingTips: [
          'Hold for minimum 5 years to benefit from compounding',
          'Sell only when you need funds or to rebalance portfolio',
          'Avoid panic selling during market crashes',
          'Take partial profits when gains exceed 50-100%',
          'Be aware of US capital gains tax (consult tax advisor)'
        ],
        salaryRecommendation: monthlyIncome >= 150000 ? 'Allocate 15-25% of monthly savings' : monthlyIncome >= 75000 ? 'Allocate 10-15% of monthly savings' : 'Start with $50-100 monthly'
      },
      {
        name: 'Global Index Funds (World Stock Market)',
        icon: '🌏',
        risk: 'Moderate',
        description: 'Diversified funds investing globally: Vanguard Total World Stock (VT), MSCI World Index (URTH), iShares MSCI ACWI (ACWI). Covers developed and emerging markets.',
        expectedReturn: '7-10% p.a.',
        minInvestment: '$500 USD (~LKR 160,000)',
        timeHorizon: 'Long-term (5-10 years)',
        features: [
          'Geographic diversification across 50+ countries',
          'Exposure to US, Europe, Asia, emerging markets',
          'Reduced single-country risk',
          'Currency diversification benefits',
          'Professional quarterly rebalancing'
        ],
        buyingTips: [
          'Ideal for first-time international investors',
          'Buy during global market uncertainties for better value',
          'Set up automatic monthly investments',
          'Use limit orders to buy at your target price',
          'Research country allocations before investing'
        ],
        sellingTips: [
          'Hold for 7-10 years minimum for optimal returns',
          'Rebalance annually to maintain target allocation',
          'Sell only during major life events or retirement',
          'Consider tax implications before selling',
          'Track global economic indicators before decisions'
        ],
        salaryRecommendation: monthlyIncome >= 200000 ? 'Allocate 10-20% of monthly savings' : monthlyIncome >= 100000 ? 'Allocate 5-10% of monthly savings' : 'Build emergency fund first'
      },
      {
        name: 'US Treasury Bonds (Government Bonds)',
        icon: '🏦',
        risk: 'Low',
        description: 'US Government bonds with guaranteed returns. Options: T-Bills (1 year), T-Notes (2-10 years), T-Bonds (20-30 years). Available via TreasuryDirect.gov or brokers.',
        expectedReturn: '4-6% p.a. (Currently)',
        minInvestment: '$100 USD (~LKR 32,000)',
        timeHorizon: 'Short to Long-term (1-30 years)',
        features: [
          'Backed by US government - zero default risk',
          'Predictable fixed income stream',
          'Currency hedge in US Dollars',
          'Low volatility compared to stocks',
          'Interest paid semi-annually'
        ],
        buyingTips: [
          'Buy when interest rates are high for better yields',
          'Ladder bonds with different maturity dates',
          'Purchase directly from TreasuryDirect.gov (no fees)',
          'Consider inflation-protected bonds (TIPS) during high inflation',
          'Ideal for conservative portion of portfolio'
        ],
        sellingTips: [
          'Hold until maturity for guaranteed return',
          'Sell in secondary market if interest rates drop (bond value increases)',
          'Use as collateral for loans if needed',
          'Reinvest maturity proceeds in higher-yielding bonds',
          'No early withdrawal penalty if sold in secondary market'
        ],
        salaryRecommendation: monthlyIncome >= 100000 ? 'Allocate 5-15% for stability' : 'Good option for emergency fund parking'
      },
      {
        name: 'Gold & Precious Metals ETFs',
        icon: '🥇',
        risk: 'Moderate',
        description: 'Gold-backed ETFs (GLD, IAU), Silver (SLV), Platinum. Physical gold exposure without storage hassles. Hedge against inflation and currency devaluation.',
        expectedReturn: '5-8% p.a. (Variable)',
        minInvestment: '$50 USD (~LKR 16,000)',
        timeHorizon: 'Long-term (3-5 years)',
        features: [
          'Inflation and currency hedge',
          'Safe haven during economic uncertainty',
          'No physical storage or security costs',
          'Highly liquid and tradable',
          'Portfolio diversification benefit'
        ],
        buyingTips: [
          'Buy during economic stability when gold prices are lower',
          'Allocate 5-10% of portfolio maximum',
          'Dollar cost average to smooth out price volatility',
          'Consider gold mining stocks (GDX) for higher returns',
          'Track USD strength - gold typically inverse to dollar'
        ],
        sellingTips: [
          'Sell during economic crises when gold price spikes',
          'Take profits when gold increases 30%+ in short time',
          'Rebalance when gold exceeds 10% of portfolio',
          'Hold as long-term insurance against currency collapse',
          'Watch central bank policies affecting gold prices'
        ],
        salaryRecommendation: 'Allocate 5-10% regardless of salary for portfolio insurance'
      },
      {
        name: 'International Real Estate Investment Trusts (REITs)',
        icon: '🏢',
        risk: 'Moderate',
        description: 'Global REITs investing in commercial properties, apartments, malls, data centers. Examples: VNQ (US), VNQI (International), O (Realty Income). Monthly dividend income.',
        expectedReturn: '6-10% p.a. + 3-5% dividend yield',
        minInvestment: '$100 USD (~LKR 32,000)',
        timeHorizon: 'Medium to Long-term (3-7 years)',
        features: [
          'Regular monthly/quarterly dividends (4-6%)',
          'Real estate exposure without property ownership',
          'Professional property management',
          'Geographic and property type diversification',
          'High liquidity compared to physical property'
        ],
        buyingTips: [
          'Buy when interest rates peak (REITs undervalued)',
          'Focus on REITs with dividend growth history',
          'Research property sectors (residential, commercial, industrial)',
          'Check occupancy rates and rental income trends',
          'Diversify across property types and geographies'
        ],
        sellingTips: [
          'Sell when interest rates are at historic lows (REITs overvalued)',
          'Trim positions after 40-50% gains',
          'Monitor dividend cuts - sell if dividends reduced',
          'Hold for dividend income during retirement',
          'Rebalance if REIT allocation exceeds 15% of portfolio'
        ],
        salaryRecommendation: monthlyIncome >= 150000 ? 'Allocate 10-15% for income generation' : monthlyIncome >= 75000 ? 'Allocate 5-10%' : 'Consider after building equity position'
      },
      {
        name: 'Cryptocurrency Portfolio (Bitcoin, Ethereum)',
        icon: '₿',
        risk: 'High',
        description: 'Digital assets with high volatility and growth potential. Bitcoin (store of value), Ethereum (smart contracts). Use Coinbase, Binance, or Kraken exchanges.',
        expectedReturn: '20-50% p.a. (Extremely volatile)',
        minInvestment: '$50 USD (~LKR 16,000)',
        timeHorizon: 'Long-term (5-10 years)',
        features: [
          'High growth potential but extreme volatility',
          'Decentralized finance exposure',
          'Portfolio diversification (uncorrelated to stocks)',
          'Institutional adoption increasing',
          '24/7 trading availability'
        ],
        buyingTips: [
          'ONLY invest 3-5% of total portfolio maximum',
          'Buy during major market crashes (50%+ drops)',
          'Dollar cost average weekly/monthly - never lump sum',
          'Use reputable exchanges with insurance (Coinbase, Kraken)',
          'Store in hardware wallet (Ledger, Trezor) for security',
          'Research before buying - understand blockchain technology'
        ],
        sellingTips: [
          'Take profits when gains exceed 100-200%',
          'Sell portions during euphoric bull runs',
          'Never sell during panic - wait for recovery',
          'Set stop-loss at 30-40% below purchase price',
          'Hold Bitcoin long-term, trade altcoins more actively',
          'Be aware of tax implications (capital gains)'
        ],
        salaryRecommendation: monthlyIncome >= 100000 ? 'Max 3-5% for risk capital only' : 'Avoid until emergency fund established'
      },
      {
        name: 'Agricultural Commodity ETFs',
        icon: '🌾',
        risk: 'Moderate',
        description: 'Invest in agricultural commodities: DBA (agriculture basket), CORN, WEAT, SOYB. Exposure to global food demand and farming markets.',
        expectedReturn: '5-12% p.a. (Seasonal)',
        minInvestment: '$100 USD (~LKR 32,000)',
        timeHorizon: 'Medium-term (2-5 years)',
        features: [
          'Exposure to global food demand',
          'Inflation hedge through commodity prices',
          'Diversification from stocks and bonds',
          'Benefit from population growth trends',
          'Seasonal price patterns for trading opportunities'
        ],
        buyingTips: [
          'Buy during harvest seasons when prices are low',
          'Invest before planting seasons for better returns',
          'Monitor weather patterns and crop reports',
          'Diversify across different crops (grains, soft commodities)',
          'Watch global supply/demand dynamics'
        ],
        sellingTips: [
          'Sell before peak harvest when prices are high',
          'Take profits during drought or supply shortage spikes',
          'Exit positions when global inventories are excessive',
          'Rebalance when commodity allocation exceeds 5-8%',
          'Monitor government policies on farming subsidies'
        ],
        salaryRecommendation: 'Allocate 3-7% for commodity diversification'
      },
      {
        name: 'Sustainable Farming Investment Platforms',
        icon: '🚜',
        risk: 'Moderate-High',
        description: 'Crowdfunded farming projects via FarmTogether, AcreTrader, or Farmfolio. Invest in real farmland and agricultural operations for passive income.',
        expectedReturn: '8-15% p.a. + land appreciation',
        minInvestment: '$5,000-15,000 USD',
        timeHorizon: 'Long-term (5-10 years)',
        features: [
          'Direct farmland ownership or shares',
          'Annual crop revenue distribution',
          'Land appreciation potential',
          'Professional farm management',
          'Sustainable and organic farming focus'
        ],
        buyingTips: [
          'Research platform track record and past returns',
          'Invest in established crop types (almonds, soybeans, corn)',
          'Diversify across multiple farms and regions',
          'Understand water rights and soil quality',
          'Check farm management team experience',
          'Review detailed crop projections and market demand'
        ],
        sellingTips: [
          'Typically 5-10 year lock-in period',
          'Secondary market available on some platforms',
          'Sell when land appreciation exceeds 30-40%',
          'Exit if farm underperforms for 2+ consecutive years',
          'Consider tax benefits before selling (1031 exchange in US)'
        ],
        salaryRecommendation: monthlyIncome >= 250000 ? 'Consider 5-10% allocation' : 'Build liquid assets first'
      }
    ];

    // Enhanced Investment tips based on user profile and salary
    const tips = [
      {
        icon: '🎯',
        title: 'Start with Emergency Fund',
        description: `With monthly income of ${formatCurrency(monthlyIncome)}, save 3-6 months expenses (${formatCurrency(monthlyExpenses * 4)}) in NSB or bank savings before investing.`
      },
      {
        icon: '💰',
        title: 'Salary-Based Investment Strategy',
        description: monthlyIncome >= 200000 
          ? 'High income earner: Allocate 60% domestic (FDs, stocks), 30% international (US ETFs, REITs), 10% alternative (gold, crypto).'
          : monthlyIncome >= 100000
          ? 'Mid income: Focus 70% domestic (FDs, unit trusts), 25% international (index funds), 5% gold as hedge.'
          : 'Entry level: Build 80% domestic savings (NSB, FDs), 15% SL stocks, 5% gold. Avoid international until savings increase.'
      },
      {
        icon: '📊',
        title: 'Dollar Cost Averaging (DCA)',
        description: 'Don\'t try to time the market. Invest a fixed amount monthly regardless of price. This reduces risk and takes emotion out of investing. Example: LKR 10,000/month into unit trust or $50/month into US ETF.'
      },
      {
        icon: '🛒',
        title: 'When to BUY Investments',
        description: '✓ Market corrections (10-20% drops) ✓ During economic uncertainty when prices are low ✓ After bad news but before recovery ✓ Systematically every month (DCA) ✓ When you have surplus savings not needed for 5+ years'
      },
      {
        icon: '💸',
        title: 'When to SELL Investments',
        description: '✓ After 50-100%+ gains (take partial profits) ✓ When fundamentals deteriorate ✓ For rebalancing portfolio ✓ Major life expenses (home, education) ✓ NEVER sell in panic during crashes ✓ Hold stocks minimum 5 years'
      },
      {
        icon: '📚',
        title: 'Diversify Your Portfolio',
        description: 'Don\'t put all eggs in one basket. Ideal allocation: 40% FDs/Bonds (safe), 30% Stocks (growth), 20% International (diversification), 10% Alternative (gold/land). Adjust based on age and risk tolerance.'
      },
      {
        icon: '⏰',
        title: 'Time in Market Beats Timing',
        description: `With ${savingsRate}% savings rate, invest early. LKR 10,000 invested monthly for 20 years at 10% return = LKR 76 lakhs! Same amount after 10 years = only LKR 20 lakhs. Time is your biggest advantage.`
      },
      {
        icon: '🌾',
        title: 'Agricultural Investment Tips',
        description: 'For farming investments: ✓ Research crop market demand ✓ Understand seasonal price cycles ✓ Check water availability and soil quality ✓ Diversify crops (rice, vegetables, coconut) ✓ Consider agri-crowdfunding platforms ✓ Monitor government subsidies and policies'
      },
      {
        icon: '💡',
        title: `Risk Profile: ${riskProfile}`,
        description: riskProfile === 'Conservative' 
          ? 'Conservative: 70% Fixed Income (FDs, Bonds), 20% Blue-chip stocks, 10% Gold. Avoid crypto and high-risk stocks.'
          : riskProfile === 'Moderate'
          ? 'Moderate: 40% Fixed Income, 40% Stocks/Funds, 15% International, 5% Gold. Balanced risk-reward approach.'
          : 'Aggressive: 30% Fixed Income, 50% Stocks/Growth funds, 15% International, 5% Crypto/High risk. Accept volatility for higher returns.'
      },
      {
        icon: '📖',
        title: 'Educate Before Investing',
        description: 'Read investment prospectus. Understand: ✓ Fees and charges ✓ Lock-in periods ✓ Exit penalties ✓ Tax implications ✓ Historical returns ✓ Risk factors. Never invest in something you don\'t understand. Knowledge = Better returns.'
      },
      {
        icon: '🔄',
        title: 'Review & Rebalance Quarterly',
        description: 'Review portfolio every 3 months. Rebalance if any asset class deviates >5% from target. Example: If stocks grow from 40% to 50%, sell 10% and buy bonds to maintain balance. Rebalancing locks profits and maintains risk level.'
      },
      {
        icon: '🌍',
        title: 'International Investing for Sri Lankans',
        description: 'Benefits: USD exposure (currency hedge), access to global companies, higher liquidity. How to start: ✓ Open Interactive Brokers account ✓ Transfer via bank (check CBSL limits) ✓ Start with index ETFs ✓ Keep 20-30% internationally for diversification'
      },
      {
        icon: '🚜',
        title: 'Farming Investment Strategies',
        description: 'Local: Buy agricultural land in developing areas (Polonnaruwa, Anuradhapura), rent to farmers, earn 8-12% yearly. International: Invest in farmland platforms (FarmTogether, AcreTrader) for US/Australia farmland exposure. Diversify crop types for stability.'
      },
      {
        icon: '⚖️',
        title: 'Tax-Smart Investing',
        description: 'In Sri Lanka: ✓ EPF contributions tax deductible ✓ Treasury bill interest tax-free ✓ Stock dividends taxed at 14% ✓ International: Capital gains tax varies (US: 15-20%). Consult tax advisor for optimization. Tax planning can save 10-30% of returns.'
      }
    ];

    // Filter recommendations based on user's savings
    let recommendedSriLanka = sriLankaInvestments;
    let recommendedInternational = internationalInvestments;

    if (monthlySavings < 10000) {
      // Low savings - focus on accessible options
      recommendedSriLanka = sriLankaInvestments.filter(inv => 
        inv.risk === 'Low' || inv.name.includes('NSB') || inv.name.includes('Unit Trust')
      );
      recommendedInternational = [];
      tips.push({
        icon: '💪',
        title: 'Focus on Building Savings First',
        description: 'Your current savings are low. Focus on increasing income and reducing expenses before aggressive investing.'
      });
    } else if (monthlySavings >= 50000) {
      // High savings - include all options
      tips.push({
        icon: '🌟',
        title: 'Excellent Savings Rate!',
        description: 'Your strong savings rate allows for diversified investments. Consider allocating across multiple asset classes.'
      });
    }

    const predictions = {
      profile: {
        monthlyIncome: Math.round(monthlyIncome),
        monthlyExpenses: Math.round(monthlyExpenses),
        monthlySavings: Math.round(monthlySavings),
        savingsRate: parseFloat(savingsRate),
        riskProfile: riskProfile
      },
      sriLanka: recommendedSriLanka,
      international: monthlySavings >= 10000 ? recommendedInternational : recommendedInternational.slice(0, 3),
      tips: tips
    };

    res.json(predictions);

  } catch (error) {
    console.error('Error generating investment predictions:', error);
    res.status(500).json({ 
      error: 'Failed to generate investment predictions',
      message: error.message 
    });
  }
});

module.exports = router;