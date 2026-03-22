const express = require('express');
const jwt = require('jsonwebtoken');

const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');

const router = express.Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

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

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getRecentMonths = (count) => {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

const linearRegressionPredictNext = (values) => {
  const n = values.length;
  if (n === 0) return 0;
  if (n === 1) return values[0];

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    const x = i + 1;
    const y = values[i] || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = (n * sumXX) - (sumX * sumX);
  const slope = denominator === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / denominator;
  const intercept = (sumY - (slope * sumX)) / n;
  const predicted = intercept + (slope * (n + 1));

  return Math.max(0, predicted);
};

const computeConfidence = (series) => {
  if (series.length < 3) return 55;

  const avg = series.reduce((a, b) => a + b, 0) / series.length;
  if (avg === 0) return 50;

  const variance = series.reduce((sum, val) => sum + ((val - avg) ** 2), 0) / series.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / avg;

  const raw = 95 - (cv * 60);
  return Math.max(45, Math.min(95, Math.round(raw)));
};

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const standardDeviation = (values) => {
  if (!values.length) return 0;
  const avg = average(values);
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildMonthlySnapshot = (transactions, monthsList) => {
  const monthlyIncomeMap = {};
  const monthlyExpenseMap = {};

  for (const tx of transactions) {
    const key = monthKey(tx.date);
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      monthlyIncomeMap[key] = (monthlyIncomeMap[key] || 0) + amount;
    } else if (tx.type === 'expense') {
      monthlyExpenseMap[key] = (monthlyExpenseMap[key] || 0) + amount;
    }
  }

  const monthlyIncomeSeries = monthsList.map((m) => Number(monthlyIncomeMap[m] || 0));
  const monthlyExpenseSeries = monthsList.map((m) => Number(monthlyExpenseMap[m] || 0));
  const monthlyNetSeries = monthsList.map((m, idx) => monthlyIncomeSeries[idx] - monthlyExpenseSeries[idx]);

  const avgIncome = average(monthlyIncomeSeries);
  const avgExpenses = average(monthlyExpenseSeries);
  const avgNetSavings = average(monthlyNetSeries);
  const netStdDev = standardDeviation(monthlyNetSeries);
  const variabilityRatio = Math.abs(avgNetSavings) > 0 ? (netStdDev / Math.abs(avgNetSavings)) : 1;
  const stabilityScore = clamp(Math.round(100 - (variabilityRatio * 50)), 20, 95);
  const savingsRate = avgIncome > 0 ? ((avgNetSavings / avgIncome) * 100) : 0;

  return {
    avgIncome,
    avgExpenses,
    avgNetSavings,
    stabilityScore,
    savingsRate
  };
};

const buildGoalAnalysis = (goals, avgExpenses) => {
  const emergencyGoals = goals.filter((goal) => goal.category === 'emergency_fund');
  const emergencyCurrent = emergencyGoals.reduce((sum, goal) => sum + (Number(goal.currentAmount) || 0), 0);
  const emergencyCoverageMonths = avgExpenses > 0 ? (emergencyCurrent / avgExpenses) : 0;

  const now = new Date();
  const upcomingGoalDays = 180;
  const upcomingGoals = goals
    .filter((goal) => new Date(goal.targetDate) > now)
    .map((goal) => {
      const targetDate = new Date(goal.targetDate);
      const remaining = Math.max(0, (Number(goal.targetAmount) || 0) - (Number(goal.currentAmount) || 0));
      const monthsLeft = Math.max(1, Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24 * 30)));
      return {
        name: goal.name,
        targetDate: goal.targetDate,
        remainingAmount: Number(remaining.toFixed(2)),
        monthlyRequired: Number((remaining / monthsLeft).toFixed(2)),
        isNearTerm: (targetDate - now) <= (upcomingGoalDays * 24 * 60 * 60 * 1000)
      };
    })
    .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));

  const nearTermGoalCount = upcomingGoals.filter((goal) => goal.isNearTerm).length;
  const requiredForGoalsMonthly = upcomingGoals.reduce((sum, goal) => sum + goal.monthlyRequired, 0);

  return {
    emergencyCoverageMonths,
    upcomingGoals,
    nearTermGoalCount,
    requiredForGoalsMonthly
  };
};

const buildRiskAndAllocation = ({ avgNetSavings, savingsRate, stabilityScore, emergencyCoverageMonths, nearTermGoalCount }) => {
  let riskProfile = 'Conservative';
  if (avgNetSavings > 0 && savingsRate >= 18 && stabilityScore >= 70 && emergencyCoverageMonths >= 3) {
    riskProfile = 'Aggressive';
  } else if (avgNetSavings > 0 && savingsRate >= 10 && stabilityScore >= 50) {
    riskProfile = 'Moderate';
  }

  let allocation = { cash: 45, fixedIncome: 35, equities: 15, alternatives: 5 };
  if (riskProfile === 'Moderate') {
    allocation = { cash: 25, fixedIncome: 30, equities: 35, alternatives: 10 };
  } else if (riskProfile === 'Aggressive') {
    allocation = { cash: 10, fixedIncome: 20, equities: 55, alternatives: 15 };
  }

  if (nearTermGoalCount > 0) {
    allocation.cash += 10;
    allocation.equities -= 10;
  }

  return { riskProfile, allocation };
};

// GET /api/ai/predictions/spending?months=6
router.get('/predictions/spending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const months = Math.max(3, Math.min(12, Number(req.query.months) || 6));

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (months - 1));
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const transactions = await Transaction.find({
      userId,
      type: 'expense',
      date: { $gte: startDate }
    }).lean();

    const budgets = await Budget.find({ userId }).lean();

    const monthsList = getRecentMonths(months);

    const byCategory = new Map();
    for (const tx of transactions) {
      const category = tx.category || 'Other';
      const bucket = byCategory.get(category) || {};
      const key = monthKey(tx.date);
      bucket[key] = (bucket[key] || 0) + (Number(tx.amount) || 0);
      byCategory.set(category, bucket);
    }

    const budgetByCategory = new Map();
    for (const b of budgets) {
      for (const item of (b.categories || [])) {
        const cat = item.category || 'Other';
        budgetByCategory.set(cat, (budgetByCategory.get(cat) || 0) + (Number(item.budgetedAmount) || 0));
      }
    }

    const categoryPredictions = [];
    for (const [category, monthTotals] of byCategory.entries()) {
      const series = monthsList.map((m) => Number(monthTotals[m] || 0));
      const predictedNext = linearRegressionPredictNext(series);
      const avg = series.reduce((a, b) => a + b, 0) / series.length;
      const confidence = computeConfidence(series);
      const budgeted = Number(budgetByCategory.get(category) || 0);

      let risk = 'low';
      if (budgeted > 0) {
        const ratio = predictedNext / budgeted;
        if (ratio >= 1) risk = 'high';
        else if (ratio >= 0.8) risk = 'medium';
      }

      categoryPredictions.push({
        category,
        averageMonthly: Number(avg.toFixed(2)),
        predictedNextMonth: Number(predictedNext.toFixed(2)),
        confidence,
        budgetedAmount: budgeted,
        risk
      });
    }

    categoryPredictions.sort((a, b) => b.predictedNextMonth - a.predictedNextMonth);

    const totalPredicted = categoryPredictions.reduce((sum, c) => sum + c.predictedNextMonth, 0);
    const totalBudgeted = categoryPredictions.reduce((sum, c) => sum + c.budgetedAmount, 0);

    res.json({
      success: true,
      model: 'statistical-linear-regression',
      generatedAt: new Date().toISOString(),
      windowMonths: months,
      summary: {
        predictedTotalExpensesNextMonth: Number(totalPredicted.toFixed(2)),
        budgetedTotal: Number(totalBudgeted.toFixed(2)),
        budgetRisk: totalBudgeted > 0 && totalPredicted > totalBudgeted ? 'high' : 'normal'
      },
      categories: categoryPredictions.slice(0, 12)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate spending prediction',
      error: error.message
    });
  }
});

// GET /api/ai/recommendations/personalized?months=6
// Uses real user behavior (income/expenses/goals) to build a personalized investment strategy.
router.get('/recommendations/personalized', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const months = Math.max(3, Math.min(12, Number(req.query.months) || 6));

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (months - 1));
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const [transactions, goals] = await Promise.all([
      Transaction.find({ userId, date: { $gte: startDate } }).lean(),
      Goal.find({ userId, status: { $in: ['active', 'paused'] } }).lean()
    ]);

    const monthsList = getRecentMonths(months);
    const monthlySnapshot = buildMonthlySnapshot(transactions, monthsList);
    const { avgIncome, avgExpenses, avgNetSavings, stabilityScore, savingsRate } = monthlySnapshot;

    const goalAnalysis = buildGoalAnalysis(goals, avgExpenses);
    const {
      emergencyCoverageMonths,
      upcomingGoals,
      nearTermGoalCount,
      requiredForGoalsMonthly
    } = goalAnalysis;

    const { riskProfile, allocation } = buildRiskAndAllocation({
      avgNetSavings,
      savingsRate,
      stabilityScore,
      emergencyCoverageMonths,
      nearTermGoalCount
    });

    const investableMonthly = Math.max(0, avgNetSavings - requiredForGoalsMonthly);
    const recommendedInvestMonthly = Math.max(0, investableMonthly * 0.7);

    const strategySet = {
      Conservative: [
        { bucket: 'cash', symbol: 'NDBIB', reason: 'capital protection and liquidity' },
        { bucket: 'fixedIncome', symbol: 'COMB.N0000', reason: 'stable local financial sector exposure' },
        { bucket: 'alternatives', symbol: 'GLD', reason: 'inflation hedge' }
      ],
      Moderate: [
        { bucket: 'fixedIncome', symbol: 'NDBIB', reason: 'balance risk with predictable returns' },
        { bucket: 'equities', symbol: 'JKH.N0000', reason: 'local diversified conglomerate exposure' },
        { bucket: 'equities', symbol: 'SPY', reason: 'broad US market growth exposure' }
      ],
      Aggressive: [
        { bucket: 'equities', symbol: 'QQQ', reason: 'higher growth global tech exposure' },
        { bucket: 'equities', symbol: 'SPY', reason: 'core diversified equity engine' },
        { bucket: 'alternatives', symbol: 'GLD', reason: 'portfolio hedge during volatility' }
      ]
    };

    const recommendations = (strategySet[riskProfile] || []).map((item) => ({
      ...item,
      suggestedMonthlyAmount: Number(((recommendedInvestMonthly * (allocation[item.bucket] / 100))).toFixed(2))
    }));

    const tips = [
      {
        icon: '🧭',
        title: 'Personalized Allocation Plan',
        description: `Based on your ${riskProfile.toLowerCase()} profile, suggested split is Cash ${allocation.cash}%, Fixed Income ${allocation.fixedIncome}%, Equities ${allocation.equities}%, Alternatives ${allocation.alternatives}%.`
      },
      {
        icon: nearTermGoalCount > 0 ? '🎯' : '💰',
        title: nearTermGoalCount > 0 ? 'Near-Term Goals Priority' : 'Investable Capacity',
        description: nearTermGoalCount > 0
          ? `${nearTermGoalCount} goal(s) due within ~6 months. Keep higher cash buffer before increasing equity risk.`
          : `Estimated monthly investable surplus: ${recommendedInvestMonthly.toFixed(2)} after goal contributions.`
      },
      {
        icon: '📊',
        title: 'Savings Stability',
        description: `Your stability score is ${stabilityScore}/100 with average net savings ${avgNetSavings.toFixed(2)} per month.`
      }
    ];

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      profile: {
        riskProfile,
        averageMonthlyIncome: Number(avgIncome.toFixed(2)),
        averageMonthlyExpenses: Number(avgExpenses.toFixed(2)),
        averageMonthlyNetSavings: Number(avgNetSavings.toFixed(2)),
        savingsRate: Number(savingsRate.toFixed(1)),
        stabilityScore,
        emergencyCoverageMonths: Number(emergencyCoverageMonths.toFixed(2)),
        requiredForGoalsMonthly: Number(requiredForGoalsMonthly.toFixed(2)),
        recommendedInvestMonthly: Number(recommendedInvestMonthly.toFixed(2))
      },
      allocation,
      upcomingGoals: upcomingGoals.slice(0, 5),
      recommendations,
      tips
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate personalized recommendations',
      error: error.message
    });
  }
});

const fallbackMarketData = {
  sriLanka: [
    { symbol: 'JKH.N0000', name: 'John Keells Holdings', type: 'equity', currency: 'LKR', note: 'Reference snapshot (fallback)' },
    { symbol: 'COMB.N0000', name: 'Commercial Bank PLC', type: 'equity', currency: 'LKR', note: 'Reference snapshot (fallback)' },
    { symbol: 'NDBIB', name: 'Sri Lanka T-Bills', type: 'fixed-income', currency: 'LKR', note: 'Reference range 12-18% p.a.' }
  ],
  abroad: [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf', currency: 'USD', note: 'Reference snapshot (fallback)' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', currency: 'USD', note: 'Reference snapshot (fallback)' },
    { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'commodity-etf', currency: 'USD', note: 'Reference snapshot (fallback)' }
  ]
};

const marketWatchlist = {
  sriLanka: [
    { symbol: 'JKH.N0000', name: 'John Keells Holdings', type: 'equity', currency: 'LKR' },
    { symbol: 'COMB.N0000', name: 'Commercial Bank PLC', type: 'equity', currency: 'LKR' },
    { symbol: 'NDBIB', name: 'Sri Lanka T-Bills', type: 'fixed-income', currency: 'LKR' }
  ],
  abroad: [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf', currency: 'USD' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', currency: 'USD' },
    { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'commodity-etf', currency: 'USD' }
  ]
};

const fetchFinnhubQuote = async (symbol, apiKey) => {
  const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`);
  if (!response.ok) {
    return { found: false, reason: `provider-status-${response.status}` };
  }

  const quote = await response.json();
  if (!quote || (quote.c === 0 && quote.pc === 0)) {
    return { found: false, reason: 'no-quote-data' };
  }

  const changePercent = quote.pc ? (((quote.c - quote.pc) / quote.pc) * 100) : 0;
  return {
    found: true,
    current: quote.c,
    high: quote.h,
    low: quote.l,
    open: quote.o,
    previousClose: quote.pc,
    change: quote.d,
    changePercent: Number(changePercent.toFixed(2))
  };
};

// GET /api/ai/market/watchlist
// Attempts live quotes for curated Sri Lanka + international symbols.
router.get('/market/watchlist', authenticateToken, async (req, res) => {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return res.json({
        success: true,
        source: 'fallback-static',
        reason: 'FINNHUB_API_KEY not configured',
        data: fallbackMarketData
      });
    }

    const enrichOne = async (item, fallback) => {
      const live = await fetchFinnhubQuote(item.symbol, apiKey);
      if (!live.found) {
        return {
          ...item,
          note: fallback?.note || 'Reference snapshot (fallback)',
          live: false,
          reason: live.reason || 'no-live-data'
        };
      }

      return {
        ...item,
        note: 'Live market quote',
        live: true,
        current: live.current,
        high: live.high,
        low: live.low,
        open: live.open,
        previousClose: live.previousClose,
        change: live.change,
        changePercent: live.changePercent,
        fetchedAt: new Date().toISOString()
      };
    };

    const sriLanka = await Promise.all(
      marketWatchlist.sriLanka.map((item) => {
        const fallback = fallbackMarketData.sriLanka.find((f) => f.symbol === item.symbol);
        return enrichOne(item, fallback);
      })
    );

    const abroad = await Promise.all(
      marketWatchlist.abroad.map((item) => {
        const fallback = fallbackMarketData.abroad.find((f) => f.symbol === item.symbol);
        return enrichOne(item, fallback);
      })
    );

    return res.json({
      success: true,
      source: 'finnhub-watchlist',
      data: { sriLanka, abroad }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch watchlist market data',
      error: error.message
    });
  }
});

// GET /api/ai/market/quote?symbol=SPY
// Uses Finnhub when FINNHUB_API_KEY is available; otherwise returns fallback references.
router.get('/market/quote', authenticateToken, async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim().toUpperCase();
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey || !symbol) {
      const reason = apiKey ? 'symbol not provided' : 'FINNHUB_API_KEY not configured';
      return res.json({
        success: true,
        source: 'fallback-static',
        reason,
        data: symbol
          ? { symbol, message: 'No live quote available without API key. Configure FINNHUB_API_KEY for live data.' }
          : fallbackMarketData
      });
    }

    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`);
    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: 'Market provider returned an error',
        providerStatus: response.status
      });
    }

    const quote = await response.json();

    if (!quote || (quote.c === 0 && quote.pc === 0)) {
      return res.json({
        success: true,
        source: 'fallback-static',
        reason: 'No quote data returned for symbol',
        data: { symbol, message: 'No live quote found for this symbol.' }
      });
    }

    const changePercent = quote.pc ? (((quote.c - quote.pc) / quote.pc) * 100) : 0;

    return res.json({
      success: true,
      source: 'finnhub-live',
      data: {
        symbol,
        current: quote.c,
        high: quote.h,
        low: quote.l,
        open: quote.o,
        previousClose: quote.pc,
        change: quote.d,
        changePercent: Number(changePercent.toFixed(2)),
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch market data',
      error: error.message
    });
  }
});

module.exports = router;
