const Goal = require('../models/Goal');
const mongoose = require('mongoose');

// Get all goals for a user
const getGoals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'active', category, priority } = req.query;

    let filter = { userId };
    if (status && status !== 'all') filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const goals = await Goal.find(filter).sort({ targetDate: 1 });

    // Add calculated fields
    const goalsWithProgress = goals.map(goal => ({
      ...goal.toObject(),
      progressPercentage: goal.progressPercentage,
      remainingAmount: Math.max(0, goal.targetAmount - goal.currentAmount),
      isOverdue: new Date() > goal.targetDate && goal.status === 'active',
      daysUntilTarget: Math.ceil((goal.targetDate - new Date()) / (1000 * 60 * 60 * 24))
    }));

    res.json(goalsWithProgress);
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new goal
const createGoal = async (req, res) => {
  try {
    const {
      name,
      description,
      targetAmount,
      category,
      priority,
      targetDate,
      monthlyContribution,
      autoContribute
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!name || !targetAmount || !targetDate) {
      return res.status(400).json({ message: 'Name, target amount, and target date are required' });
    }

    if (targetAmount <= 0) {
      return res.status(400).json({ message: 'Target amount must be greater than 0' });
    }

    if (new Date(targetDate) <= new Date()) {
      return res.status(400).json({ message: 'Target date must be in the future' });
    }

    // Create milestones (25%, 50%, 75%, 100%)
    const milestones = [25, 50, 75, 100].map(percentage => ({
      percentage,
      amount: (targetAmount * percentage) / 100,
      achieved: false
    }));

    // Create goal
    const goal = new Goal({
      userId,
      name,
      description: description || '',
      targetAmount,
      category: category || 'other',
      priority: priority || 'medium',
      targetDate: new Date(targetDate),
      monthlyContribution: monthlyContribution || 0,
      autoContribute: autoContribute || false,
      milestones
    });

    await goal.save();

    // Generate financial analysis and savings plan
    const analysis = await generateGoalAnalysis(userId, goal);

    res.status(201).json({
      message: 'Goal created successfully',
      goal: {
        ...goal.toObject(),
        progressPercentage: goal.progressPercentage
      },
      analysis
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update goal
const updateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    // Don't allow updating completed goals
    if (goal.status === 'completed') {
      return res.status(400).json({ message: 'Cannot update completed goal' });
    }

    const oldTargetAmount = goal.targetAmount;

    // Update goal
    Object.assign(goal, req.body);

    // Update milestones if target amount changed
    if (req.body.targetAmount && req.body.targetAmount !== oldTargetAmount) {
      goal.milestones = goal.milestones.map(milestone => ({
        ...milestone,
        amount: (goal.targetAmount * milestone.percentage) / 100
      }));
    }

    // Check if goal is completed
    if (goal.currentAmount >= goal.targetAmount && goal.status === 'active') {
      goal.status = 'completed';
    }

    await goal.save();

    res.json({
      message: 'Goal updated successfully',
      goal: {
        ...goal.toObject(),
        progressPercentage: goal.progressPercentage
      }
    });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add contribution to goal
const addContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Contribution amount must be greater than 0' });
    }

    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (goal.status !== 'active') {
      return res.status(400).json({ message: 'Cannot add contribution to inactive goal' });
    }

    // Add contribution
    goal.contributions.push({
      amount: parseFloat(amount),
      date: new Date(),
      note: note || ''
    });

    // Update current amount
    goal.currentAmount += parseFloat(amount);

    // Check and update milestones
    const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
    goal.milestones.forEach(milestone => {
      if (!milestone.achieved && progressPercentage >= milestone.percentage) {
        milestone.achieved = true;
        milestone.achievedDate = new Date();
      }
    });

    // Check if goal is completed
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'completed';
    }

    await goal.save();

    res.json({
      message: 'Contribution added successfully',
      goal: {
        ...goal.toObject(),
        progressPercentage: goal.progressPercentage
      }
    });
  } catch (error) {
    console.error('Add contribution error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete goal
const deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    await Goal.deleteOne({ _id: id });

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get goal analytics - Individual goal analysis
const getGoalAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const goalId = req.params.id;

    // Get the specific goal
    const goal = await Goal.findOne({ _id: goalId, userId });
    
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    // Generate comprehensive analysis for this goal
    const analysis = await generateGoalAnalysis(userId, goal);

    res.json({
      message: 'Goal analysis generated successfully',
      analysis
    });
  } catch (error) {
    console.error('Goal analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to generate goal recommendations
const generateGoalRecommendations = (goals) => {
  const recommendations = [];

  goals.forEach(goal => {
    const progress = goal.progressPercentage;
    const daysUntilTarget = Math.ceil((goal.targetDate - new Date()) / (1000 * 60 * 60 * 24));
    const remainingAmount = goal.targetAmount - goal.currentAmount;

    // Stagnant goal recommendation
    if (progress < 10 && goal.contributions.length === 0) {
      recommendations.push({
        type: 'start_contributing',
        goalId: goal._id,
        goalName: goal.name,
        message: `Start contributing to your "${goal.name}" goal. Even small amounts help!`,
        suggestedAction: `Try contributing $${Math.ceil(remainingAmount / Math.max(daysUntilTarget / 30, 1))} monthly`
      });
    }

    // Behind schedule recommendation
    if (daysUntilTarget > 0 && goal.monthlyContribution > 0) {
      const monthsRemaining = daysUntilTarget / 30;
      const requiredMonthlyContribution = remainingAmount / monthsRemaining;
      
      if (requiredMonthlyContribution > goal.monthlyContribution * 1.2) {
        recommendations.push({
          type: 'increase_contribution',
          goalId: goal._id,
          goalName: goal.name,
          message: `You may need to increase contributions to reach "${goal.name}" on time`,
          suggestedAction: `Consider increasing monthly contribution to $${Math.ceil(requiredMonthlyContribution)}`
        });
      }
    }

    // Nearly complete recommendation
    if (progress >= 90 && progress < 100) {
      recommendations.push({
        type: 'final_push',
        goalId: goal._id,
        goalName: goal.name,
        message: `You're almost there! Only $${remainingAmount.toFixed(2)} left for "${goal.name}"`,
        suggestedAction: 'Consider making a final contribution to complete this goal'
      });
    }
  });

  return recommendations;
};

// Generate comprehensive financial analysis for a goal
const generateGoalAnalysis = async (userId, goal) => {
  try {
    // Get user's transaction data
    const Transaction = require('../models/Transaction');
    const User = require('../models/User');
    
    const [transactions, user] = await Promise.all([
      Transaction.find({ userId }).sort({ date: -1 }).limit(100),
      User.findById(userId)
    ]);

    const monthsToGoal = Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24 * 30));
    const requiredMonthlySaving = goal.targetAmount / monthsToGoal;

    // Calculate income and expense averages
    const recentMonthsData = calculateRecentFinancialData(transactions);
    const monthlyIncome = user.monthlySalary + (recentMonthsData.avgMonthlyIncome || 0);
    const monthlyExpenses = recentMonthsData.avgMonthlyExpenses || 0;
    const currentSavingsCapacity = monthlyIncome - monthlyExpenses;

    // Generate analysis
    const analysis = {
      goalSummary: {
        name: goal.name,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        monthsToGoal,
        requiredMonthlySaving
      },
      financialSnapshot: {
        monthlyIncome,
        monthlyExpenses,
        currentSavingsCapacity,
        savingsRate: ((currentSavingsCapacity / monthlyIncome) * 100).toFixed(1)
      },
      feasibilityAnalysis: generateFeasibilityAnalysis(requiredMonthlySaving, currentSavingsCapacity, monthlyIncome),
      savingsStrategy: generateSavingsStrategy(requiredMonthlySaving, currentSavingsCapacity, recentMonthsData),
      budgetRecommendations: generateBudgetRecommendations(recentMonthsData, requiredMonthlySaving),
      milestonesPlan: generateMilestonesPlan(goal.targetAmount, monthsToGoal),
      riskAssessment: generateRiskAssessment(requiredMonthlySaving, currentSavingsCapacity, monthsToGoal)
    };

    return analysis;
  } catch (error) {
    console.error('Goal analysis error:', error);
    return { error: 'Unable to generate analysis' };
  }
};

// Calculate recent financial data
const calculateRecentFinancialData = (transactions) => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
  
  const recentTransactions = transactions.filter(t => new Date(t.date) >= threeMonthsAgo);
  
  const monthlyData = {};
  recentTransactions.forEach(transaction => {
    const monthKey = new Date(transaction.date).toISOString().substring(0, 7);
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }
    
    if (transaction.type === 'income') {
      monthlyData[monthKey].income += transaction.amount;
    } else {
      monthlyData[monthKey].expenses += transaction.amount;
    }
  });

  const months = Object.values(monthlyData);
  const avgMonthlyIncome = months.length > 0 ? months.reduce((sum, m) => sum + m.income, 0) / months.length : 0;
  const avgMonthlyExpenses = months.length > 0 ? months.reduce((sum, m) => sum + m.expenses, 0) / months.length : 0;

  // Category breakdown
  const categorySpending = {};
  recentTransactions.filter(t => t.type === 'expense').forEach(transaction => {
    categorySpending[transaction.category] = (categorySpending[transaction.category] || 0) + transaction.amount;
  });

  return {
    avgMonthlyIncome,
    avgMonthlyExpenses,
    categorySpending,
    transactionCount: recentTransactions.length
  };
};

// Generate feasibility analysis
const generateFeasibilityAnalysis = (requiredMonthlySaving, currentSavingsCapacity, monthlyIncome) => {
  const feasibilityScore = Math.min(100, Math.max(0, (currentSavingsCapacity / requiredMonthlySaving) * 100));
  
  let status, message, difficulty;
  
  if (feasibilityScore >= 100) {
    status = 'excellent';
    difficulty = 'easy';
    message = 'Great news! Your current savings capacity exceeds the required amount. You can achieve this goal comfortably.';
  } else if (feasibilityScore >= 80) {
    status = 'good';
    difficulty = 'moderate';
    message = 'Good! You have strong savings capacity. With minor adjustments, this goal is very achievable.';
  } else if (feasibilityScore >= 60) {
    status = 'challenging';
    difficulty = 'moderate';
    message = 'This goal is challenging but achievable. You\'ll need to optimize your budget and reduce some expenses.';
  } else if (feasibilityScore >= 40) {
    status = 'difficult';
    difficulty = 'hard';
    message = 'This goal requires significant budget changes and expense reduction. Consider extending the timeline.';
  } else {
    status = 'very_difficult';
    difficulty = 'very_hard';
    message = 'This goal is very ambitious with your current financial situation. Consider increasing income or extending the deadline.';
  }

  return {
    feasibilityScore: Math.round(feasibilityScore),
    status,
    difficulty,
    message,
    shortfall: Math.max(0, requiredMonthlySaving - currentSavingsCapacity),
    surplusPercentage: ((currentSavingsCapacity / requiredMonthlySaving) * 100).toFixed(1)
  };
};

// Generate savings strategy
const generateSavingsStrategy = (requiredMonthlySaving, currentSavingsCapacity, recentData) => {
  const strategies = [];
  
  if (currentSavingsCapacity >= requiredMonthlySaving) {
    strategies.push({
      type: 'automatic_savings',
      title: 'Set Up Automatic Transfers',
      description: `Automatically transfer $${requiredMonthlySaving.toFixed(2)} monthly to your goal savings.`,
      impact: 'high',
      effort: 'low'
    });
  } else {
    const shortfall = requiredMonthlySaving - currentSavingsCapacity;
    
    strategies.push({
      type: 'expense_reduction',
      title: 'Reduce Monthly Expenses',
      description: `Find ways to cut $${shortfall.toFixed(2)} from monthly spending.`,
      impact: 'high',
      effort: 'medium'
    });
    
    strategies.push({
      type: 'income_increase',
      title: 'Increase Monthly Income',
      description: `Consider side income or salary negotiation to earn extra $${shortfall.toFixed(2)}/month.`,
      impact: 'high',
      effort: 'high'
    });
  }
  
  strategies.push({
    type: 'windfall_allocation',
    title: 'Use Windfalls Wisely',
    description: 'Allocate bonuses, tax refunds, or unexpected income directly to this goal.',
    impact: 'medium',
    effort: 'low'
  });

  return strategies;
};

// Generate budget recommendations
const generateBudgetRecommendations = (recentData, requiredMonthlySaving) => {
  const recommendations = [];
  const { categorySpending } = recentData;
  
  // Sort categories by spending amount
  const sortedCategories = Object.entries(categorySpending)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  sortedCategories.forEach(([category, amount]) => {
    const monthlyAmount = amount / 3; // Average over 3 months
    let reductionTarget, description;
    
    switch(category.toLowerCase()) {
      case 'food':
      case 'dining':
        reductionTarget = monthlyAmount * 0.2; // 20% reduction
        description = 'Cook more at home, meal prep, use coupons';
        break;
      case 'entertainment':
        reductionTarget = monthlyAmount * 0.3; // 30% reduction
        description = 'Find free activities, limit streaming subscriptions';
        break;
      case 'shopping':
        reductionTarget = monthlyAmount * 0.4; // 40% reduction
        description = 'Implement 24-hour rule, focus on needs vs wants';
        break;
      case 'transportation':
        reductionTarget = monthlyAmount * 0.15; // 15% reduction
        description = 'Use public transport, carpool, combine trips';
        break;
      default:
        reductionTarget = monthlyAmount * 0.1; // 10% reduction
        description = 'Look for alternatives, negotiate better rates';
    }
    
    if (reductionTarget > 5) { // Only suggest if savings > $5
      recommendations.push({
        category,
        currentSpending: monthlyAmount,
        suggestedReduction: reductionTarget,
        newBudget: monthlyAmount - reductionTarget,
        description,
        priority: reductionTarget >= requiredMonthlySaving * 0.3 ? 'high' : 'medium'
      });
    }
  });
  
  return recommendations.slice(0, 3); // Top 3 recommendations
};

// Generate milestones plan
const generateMilestonesPlan = (targetAmount, monthsToGoal) => {
  const milestones = [];
  const monthlyTarget = targetAmount / monthsToGoal;
  
  [25, 50, 75, 100].forEach((percentage, index) => {
    const amount = (targetAmount * percentage) / 100;
    const targetMonth = Math.ceil((monthsToGoal * percentage) / 100);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + targetMonth);
    
    milestones.push({
      percentage,
      amount,
      targetMonth,
      targetDate,
      description: `Milestone ${index + 1}: ${percentage}% Complete`,
      celebration: generateCelebrationIdea(percentage)
    });
  });
  
  return milestones;
};

// Generate risk assessment
const generateRiskAssessment = (requiredMonthlySaving, currentSavingsCapacity, monthsToGoal) => {
  const risks = [];
  const riskLevel = currentSavingsCapacity < requiredMonthlySaving ? 'high' : 'low';
  
  if (monthsToGoal <= 6) {
    risks.push({
      type: 'timeline_risk',
      level: 'medium',
      description: 'Short timeline may require aggressive saving',
      mitigation: 'Consider extending deadline or increasing income'
    });
  }
  
  if (requiredMonthlySaving > currentSavingsCapacity * 1.5) {
    risks.push({
      type: 'income_risk',
      level: 'high',
      description: 'Goal requires significant lifestyle changes',
      mitigation: 'Break into smaller goals or increase timeline'
    });
  }
  
  risks.push({
    type: 'emergency_risk',
    level: 'low',
    description: 'Unexpected expenses could delay progress',
    mitigation: 'Maintain emergency fund separate from goal savings'
  });
  
  return {
    overallRisk: riskLevel,
    risks,
    successProbability: Math.min(95, Math.max(30, (currentSavingsCapacity / requiredMonthlySaving) * 70))
  };
};

// Generate celebration ideas
const generateCelebrationIdea = (percentage) => {
  const ideas = {
    25: "Treat yourself to a small reward - you're on track!",
    50: "You're halfway there! Plan a small celebration dinner.",
    75: "Almost there! Share your progress with friends and family.",
    100: "Goal achieved! Celebrate with something meaningful within your budget."
  };
  return ideas[percentage] || "Acknowledge your progress!";
};

module.exports = {
  getGoals,
  createGoal,
  updateGoal,
  addContribution,
  deleteGoal,
  getGoalAnalytics
};