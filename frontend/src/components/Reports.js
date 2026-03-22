import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserData, clearAuthData, formatCurrency } from '../utils/auth';
import './styles/Reports.css';
/* global globalThis */

const Reports = () => {
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [investmentPredictions, setInvestmentPredictions] = useState(null);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [lastPredictionRefresh, setLastPredictionRefresh] = useState(null);
  const isFetchingRef = useRef(false);
  const navigate = useNavigate();
  
  const handleOpenNotifications = () => {
    setShowProfileDropdown(false);
    navigate('/home', { state: { openNotifications: true } });
  };

  const getPeriodLabel = (period) => {
    if (period === '30d') return 'Last 30 Days';
    if (period === '90d') return 'Last 90 Days';
    if (period === '12m') return 'Last 12 Months';
    return 'Selected Period';
  };

  const getPeriodText = (period) => {
    if (period === '30d') return '30 days';
    if (period === '90d') return '90 days';
    return '12 months';
  };

  const getBudgetStatusLabel = (status) => {
    if (status === 'over') return '⚠️ Over Budget';
    if (status === 'no-budget') return '📝 No Budget Set';
    return '✅ Under Budget';
  };

  const getBudgetStatusMeta = (status, spentPercentage) => {
    if (status === 'no-budget') return '(Create budget to track)';
    return `(${spentPercentage.toFixed(1)}%)`;
  };

  const formatMarketPrice = (value, currency) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
    return `${value.toFixed(2)} ${currency || ''}`.trim();
  };

  const formatChangePercent = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getChangeClass = (value) => {
    if (typeof value !== 'number') return '';
    return value >= 0 ? 'positive' : 'negative';
  };

  const buildMarketInvestments = (items, icon, monthlyIncome, fallbackText) => {
    if (!Array.isArray(items)) return [];

    let salaryRecommendation;
    if (icon === '🌍') {
      salaryRecommendation = monthlyIncome >= 100000
        ? 'Use 10-20% of monthly savings for global diversification.'
        : 'Build emergency fund first, then start small monthly contributions.';
    }

    return items.map((item) => ({
      icon,
      name: item.name,
      risk: item.live ? 'Low' : 'Moderate',
      description: item.live
        ? 'Live quote connected from market provider.'
        : (item.note || fallbackText),
      expectedReturn: 'Market-linked',
      minInvestment: 'Varies',
      timeHorizon: icon === '🇱🇰' ? 'Medium to Long-term' : 'Long-term',
      live: Boolean(item.live),
      currentPrice: item.current,
      changePercent: item.changePercent,
      currency: item.currency,
      features: [
        `Symbol: ${item.symbol}`,
        `Type: ${item.type}`,
        `Currency: ${item.currency}`
      ],
      salaryRecommendation
    }));
  };

  const fetchAuthorizedJson = async (url, token, errorMessage) => {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const resolveRiskProfile = (savingsRate, personalizedProfile) => {
    if (personalizedProfile?.riskProfile) {
      return personalizedProfile.riskProfile;
    }

    const numericSavingsRate = Number(savingsRate);
    if (numericSavingsRate >= 25) return 'Aggressive';
    if (numericSavingsRate >= 12) return 'Moderate';
    return 'Conservative';
  };

  // Initialize user data
  useEffect(() => {
    const userData = getUserData();
    if (userData) {
      setUser(userData);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch report data from backend
  const fetchReportData = useCallback(async () => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/reports/analytics?period=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch reports: ${response.status}`);
      }

      const data = await response.json();
      console.log('Report data received:', data);
      console.log('Budget performance data:', data.budgetPerformance);
      setReportData(data);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(err.message || 'Failed to load report data');
      
      // Don't set fallback data - let user know there's an issue
      setReportData(null);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [dateRange]);

  // Fetch data when component mounts or dateRange changes
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Fetch investment predictions
  const fetchInvestmentPredictions = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingPredictions(true);
    }
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const spendingData = await fetchAuthorizedJson(
        '/api/ai/predictions/spending?months=6',
        token,
        'Failed to fetch AI spending predictions'
      );

      const personalizedResponse = await fetch('/api/ai/recommendations/personalized?months=6', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let personalizedData = { profile: {}, tips: [], recommendations: [], allocation: {} };
      if (personalizedResponse.ok) {
        personalizedData = await personalizedResponse.json();
      }

      let marketData = { data: { sriLanka: [], abroad: [] } };
      try {
        marketData = await fetchAuthorizedJson(
          '/api/ai/market/watchlist',
          token,
          'Failed to fetch market watchlist'
        );
      } catch (marketError) {
        console.warn('Using fallback watchlist state:', marketError.message);
      }

      const monthlyIncome = Number(reportData?.summary?.totalIncome || 0) / 3;
      const monthlyExpenses = Number(reportData?.summary?.totalExpenses || 0) / 3;
      const monthlySavings = monthlyIncome - monthlyExpenses;
      const savingsRate = monthlyIncome > 0 ? ((monthlySavings / monthlyIncome) * 100).toFixed(1) : '0.0';

      const spendingCategories = Array.isArray(spendingData?.categories) ? spendingData.categories : [];
      const highRiskCategories = spendingCategories.filter((c) => c.risk === 'high');

      const sriLanka = buildMarketInvestments(
        marketData?.data?.sriLanka,
        '🇱🇰',
        monthlyIncome,
        'Sri Lanka market reference instrument.'
      );

      const international = buildMarketInvestments(
        marketData?.data?.abroad,
        '🌍',
        monthlyIncome,
        'International market reference instrument.'
      );

      const tips = [
        {
          icon: '📉',
          title: 'AI Spending Forecast',
          description: `Predicted next-month expenses: ${formatCurrency(spendingData?.summary?.predictedTotalExpensesNextMonth || 0)} using ${spendingData?.model || 'statistical model'}.`
        },
        {
          icon: highRiskCategories.length > 0 ? '⚠️' : '✅',
          title: highRiskCategories.length > 0 ? 'Budget Risk Alert' : 'Budget Health',
          description: highRiskCategories.length > 0
            ? `${highRiskCategories.length} categories may exceed budget next month. Focus on top risks first.`
            : 'No high-risk budget categories detected in next-month forecast.'
        },
        {
          icon: '🧠',
          title: 'Confidence Score',
          description: spendingCategories.length > 0
            ? `Average model confidence: ${Math.round(spendingCategories.reduce((s, c) => s + (c.confidence || 0), 0) / spendingCategories.length)}%.`
            : 'Add more transactions to improve model confidence and prediction quality.'
        }
      ];

      const riskProfile = resolveRiskProfile(savingsRate, personalizedData?.profile);

      const marketItems = [...sriLanka, ...international];
      const liveCount = marketItems.filter((item) => item.live).length;
      const totalCount = marketItems.length;
      const sourceStatus = liveCount > 0 ? 'Live' : 'Fallback';

      setInvestmentPredictions({
        profile: {
          monthlyIncome,
          monthlySavings,
          savingsRate,
          riskProfile,
          stabilityScore: personalizedData?.profile?.stabilityScore,
          emergencyCoverageMonths: personalizedData?.profile?.emergencyCoverageMonths,
          recommendedInvestMonthly: personalizedData?.profile?.recommendedInvestMonthly
        },
        sriLanka,
        international,
        tips: [...tips, ...(personalizedData?.tips || [])],
        personalized: {
          recommendations: personalizedData?.recommendations || [],
          allocation: personalizedData?.allocation || {}
        },
        source: {
          predictions: 'GET /api/ai/predictions/spending',
          personalization: 'GET /api/ai/recommendations/personalized',
          market: 'GET /api/ai/market/watchlist',
          marketProvider: marketData?.source || 'unknown',
          sourceStatus,
          liveCount,
          totalCount
        }
      });
      setLastPredictionRefresh(new Date());
    } catch (err) {
      console.error('Error fetching investment predictions:', err);
      setInvestmentPredictions({ error: err.message });
    } finally {
      if (!silent) {
        setLoadingPredictions(false);
      }
    }
  }, [reportData]);

  const renderInvestmentPredictions = () => {
    if (loadingPredictions) {
      return (
        <div className="loading-predictions">
          <div className="loading-spinner"></div>
          <p>Analyzing your financial profile...</p>
        </div>
      );
    }

    if (investmentPredictions?.error) {
      return (
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <p>{investmentPredictions.error}</p>
          <button onClick={fetchInvestmentPredictions} className="retry-btn">
            Try Again
          </button>
        </div>
      );
    }

    if (!investmentPredictions) {
      return (
        <div className="no-predictions">
          <div className="no-data-icon">🤖</div>
          <h4>Get Your Personalized Investment Recommendations</h4>
          <p>Click the button below to receive AI-powered investment suggestions tailored to your income and savings.</p>
          <button onClick={fetchInvestmentPredictions} className="get-predictions-btn">
            🚀 Get Investment Predictions
          </button>
        </div>
      );
    }

    return (
      <div className="investment-predictions-content">
        {/* Financial Profile Summary */}
        <div className="financial-profile">
          <h4>📊 Your Financial Profile</h4>
          <div className="market-source-row">
            <span className={`market-source-badge ${investmentPredictions.source?.sourceStatus?.toLowerCase() || 'fallback'}`}>
              {investmentPredictions.source?.sourceStatus || 'Fallback'} Data
            </span>
            <span className="market-source-meta">
              {investmentPredictions.source?.liveCount || 0}/{investmentPredictions.source?.totalCount || 0} live quotes
            </span>
            <span className="market-source-meta">
              Updated: {lastPredictionRefresh ? lastPredictionRefresh.toLocaleTimeString() : 'N/A'}
            </span>
          </div>
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="stat-label">Monthly Income:</span>
              <span className="stat-value">{formatCurrency(investmentPredictions.profile?.monthlyIncome || 0)}</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label">Monthly Savings:</span>
              <span className="stat-value">{formatCurrency(investmentPredictions.profile?.monthlySavings || 0)}</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label">Savings Rate:</span>
              <span className="stat-value">{investmentPredictions.profile?.savingsRate || 0}%</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label">Risk Profile:</span>
              <span className={`stat-value risk-${investmentPredictions.profile?.riskProfile?.toLowerCase()}`}>
                {investmentPredictions.profile?.riskProfile || 'Moderate'}
              </span>
            </div>
            <div className="profile-stat">
              <span className="stat-label">Stability Score:</span>
              <span className="stat-value">{investmentPredictions.profile?.stabilityScore ?? 'N/A'}</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label">Emergency Coverage:</span>
              <span className="stat-value">{investmentPredictions.profile?.emergencyCoverageMonths ?? 'N/A'} months</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label">Recommended Monthly Invest:</span>
              <span className="stat-value">{formatCurrency(investmentPredictions.profile?.recommendedInvestMonthly || 0)}</span>
            </div>
          </div>
        </div>

        {investmentPredictions.personalized?.recommendations?.length > 0 && (
          <div className="financial-profile">
            <h4>🧠 Personalized Strategy Picks</h4>
            <div className="investment-features">
              <ul>
                {investmentPredictions.personalized.recommendations.map((item) => (
                  <li key={`${item.symbol}-${item.bucket}`}>
                    <strong>{item.symbol}</strong> ({item.bucket}) - {item.reason}. Suggested monthly amount: {formatCurrency(item.suggestedMonthlyAmount || 0)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Investment Recommendations for Sri Lanka */}
        <div className="investment-region">
          <h4>🇱🇰 Sri Lanka Investment Opportunities</h4>
          <div className="investment-grid">
            {investmentPredictions.sriLanka?.map((investment) => (
              <div
                key={`${investment.name || 'sri-lanka'}-${investment.risk || 'risk'}-${investment.expectedReturn || 'return'}`}
                className={`investment-card ${investment.risk.toLowerCase()}`}
              >
                <div className="investment-header">
                  <div className="investment-icon">{investment.icon}</div>
                  <div className="investment-title-section">
                    <h5>{investment.name}</h5>
                    <span className={`risk-badge ${investment.risk.toLowerCase()}`}>
                      {investment.risk} Risk
                    </span>
                  </div>
                </div>
                <div className="investment-details">
                  <p className="investment-description">{investment.description}</p>
                  <div className="investment-metrics">
                    <div className="metric">
                      <span className="metric-label">Live Price:</span>
                      <span className="metric-value">{formatMarketPrice(investment.currentPrice, investment.currency)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Daily Move:</span>
                      <span className={`metric-value ${getChangeClass(investment.changePercent)}`}>
                        {formatChangePercent(investment.changePercent)}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Expected Return:</span>
                      <span className="metric-value positive">{investment.expectedReturn}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Min. Investment:</span>
                      <span className="metric-value">{investment.minInvestment}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Time Horizon:</span>
                      <span className="metric-value">{investment.timeHorizon}</span>
                    </div>
                  </div>
                  <div className="investment-features">
                    <strong>Key Features:</strong>
                    <ul>
                      {investment.features?.map((feature) => (
                        <li key={`${investment.name || 'investment'}-feature-${feature}`}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* International Investment Options */}
        <div className="investment-region">
          <h4>🌍 International Investment Opportunities</h4>
          <div className="investment-grid">
            {investmentPredictions.international?.map((investment) => (
              <div
                key={`${investment.name || 'international'}-${investment.risk || 'risk'}-${investment.expectedReturn || 'return'}`}
                className={`investment-card ${investment.risk.toLowerCase()}`}
              >
                <div className="investment-header">
                  <div className="investment-icon">{investment.icon}</div>
                  <div className="investment-title-section">
                    <h5>{investment.name}</h5>
                    <span className={`risk-badge ${investment.risk.toLowerCase()}`}>
                      {investment.risk} Risk
                    </span>
                  </div>
                </div>
                <div className="investment-details">
                  <p className="investment-description">{investment.description}</p>
                  <div className="investment-metrics">
                    <div className="metric">
                      <span className="metric-label">Live Price:</span>
                      <span className="metric-value">{formatMarketPrice(investment.currentPrice, investment.currency)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Daily Move:</span>
                      <span className={`metric-value ${getChangeClass(investment.changePercent)}`}>
                        {formatChangePercent(investment.changePercent)}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Expected Return:</span>
                      <span className="metric-value positive">{investment.expectedReturn}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Min. Investment:</span>
                      <span className="metric-value">{investment.minInvestment}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Time Horizon:</span>
                      <span className="metric-value">{investment.timeHorizon}</span>
                    </div>
                  </div>
                  {investment.salaryRecommendation && (
                    <div className="salary-recommendation">
                      <strong>💼 For Your Salary:</strong>
                      <p>{investment.salaryRecommendation}</p>
                    </div>
                  )}
                  <div className="investment-features">
                    <strong>Key Features:</strong>
                    <ul>
                      {investment.features?.map((feature) => (
                        <li key={`${investment.name || 'investment'}-feature-${feature}`}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                  {investment.buyingTips && (
                    <div className="investment-tips-section">
                      <strong>🛒 Buying Tips:</strong>
                      <ul>
                        {investment.buyingTips.map((tip) => (
                          <li key={`${investment.name || 'investment'}-buy-${tip}`}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {investment.sellingTips && (
                    <div className="investment-tips-section">
                      <strong>💸 Selling Tips:</strong>
                      <ul>
                        {investment.sellingTips.map((tip) => (
                          <li key={`${investment.name || 'investment'}-sell-${tip}`}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investment Tips */}
        <div className="investment-tips">
          <h4>💡 Investment Tips</h4>
          <div className="tips-grid">
            {investmentPredictions.tips?.map((tip) => (
              <div key={`${tip.title || 'tip'}-${tip.icon || 'icon'}`} className="tip-card">
                <div className="tip-icon">{tip.icon}</div>
                <div className="tip-content">
                  <h5>{tip.title}</h5>
                  <p>{tip.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="investment-disclaimer">
          <strong>⚠️ Investment Disclaimer:</strong> These recommendations are AI-generated based on your financial profile
          and general market conditions. They are for informational purposes only and do not constitute financial advice.
          Please consult with a certified financial advisor before making investment decisions. Past performance does not
          guarantee future results. All investments carry risk, including potential loss of principal.
        </div>
      </div>
    );
  };

  // Fetch predictions when switching to overview tab
  useEffect(() => {
    if (activeTab === 'overview' && !investmentPredictions && reportData) {
      fetchInvestmentPredictions();
    }
  }, [activeTab, investmentPredictions, reportData, fetchInvestmentPredictions]);

  useEffect(() => {
    if (activeTab !== 'overview' || !investmentPredictions || loadingPredictions) {
      return undefined;
    }

    const timer = setInterval(() => {
      fetchInvestmentPredictions(true);
    }, 60000);

    return () => clearInterval(timer);
  }, [activeTab, investmentPredictions, loadingPredictions, fetchInvestmentPredictions]);

  // Download PDF report
  const downloadPDF = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Authentication token not found. Please login again.');
        return;
      }

      const response = await fetch(`/api/reports/pdf?period=${dateRange}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-report-${dateRange}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
      
      alert('PDF report downloaded successfully!');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert(`Error generating PDF report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Download Excel report
  const downloadExcel = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Authentication token not found. Please login again.');
        return;
      }

      const response = await fetch(`/api/reports/excel?period=${dateRange}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Excel generation failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-data-${dateRange}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
      
      alert('Excel report downloaded successfully!');
    } catch (err) {
      console.error('Error downloading Excel:', err);
      alert(`Error generating Excel report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate Financial Summary
  const generateSummary = async () => {
    try {
      if (!reportData?.summary) {
        alert('No report data available. Please wait for data to load or refresh the page.');
        return;
      }

      const periodLabel = getPeriodLabel(dateRange);

      const summaryContent = `FINANCIAL SUMMARY REPORT
==================================================
Period: ${periodLabel}
Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
User: ${user?.name || 'User'}

FINANCIAL OVERVIEW:
==================================================
• Total Income: ${formatCurrency(reportData.summary.totalIncome || 0)}
• Total Expenses: ${formatCurrency(reportData.summary.totalExpenses || 0)}
• Net Savings: ${formatCurrency(reportData.summary.netSavings || 0)}
• Savings Rate: ${Number(reportData.summary.savingsRate || 0).toFixed(1)}%
• Total Transactions: ${reportData.summary.transactionCount || 0}

MONTHLY TRENDS:
==================================================
${reportData.monthlyTrends && reportData.monthlyTrends.length > 0 ? 
  reportData.monthlyTrends.map(trend => 
    `• ${trend.month}: Income ${formatCurrency(trend.income || 0)}, Expenses ${formatCurrency(trend.expenses || 0)}, Net ${formatCurrency(trend.savings || 0)}`
  ).join('\n') : 'No monthly trend data available for this period.'}

TOP SPENDING CATEGORIES:
==================================================
${reportData.categoryBreakdown && reportData.categoryBreakdown.length > 0 ? 
  reportData.categoryBreakdown.slice(0, 5).map(cat => 
    `• ${cat.name || 'Unknown'}: ${formatCurrency(cat.amount || 0)} (${typeof cat.percentage === 'number' ? cat.percentage.toFixed(1) : (cat.percentage || '0.0')}%)`
  ).join('\n') : 'No category spending data available for this period.'}

BUDGET PERFORMANCE:
==================================================
${reportData.budgetPerformance && reportData.budgetPerformance.length > 0 ? 
  reportData.budgetPerformance.map(budget => 
    `• ${budget.category}: Budgeted ${formatCurrency(budget.budgeted || 0)}, Spent ${formatCurrency(budget.spent || 0)} (${budget.status === 'over' ? 'Over Budget' : 'Under Budget'})`
  ).join('\n') : 'No budget performance data available.'}

==================================================
Report generated by MoneyVue Finance Tracker
Keep this information confidential and secure.
`;

      const blob = new Blob([summaryContent], { type: 'text/plain;charset=utf-8' });
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MoneyVue-Summary-${dateRange}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
      
      alert('✅ Financial summary downloaded successfully!');
    } catch (err) {
      console.error('Error generating summary:', err);
      alert(`❌ Error generating financial summary: ${err.message || 'Please try again.'}`);
    }
  };

  // Utility functions
  const getTimeOfDayGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleLogout = () => {
    clearAuthData();
    navigate('/login');
  };

  // Loading state
  if (loading && !reportData) {
    return (
      <div className="reports-container">
        <div className="loading-dashboard">
          <div className="loading-spinner"></div>
          <p>Loading your financial reports...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !reportData) {
    return (
      <div className="reports-container">
        <div className="error-container">
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h2>Error Loading Reports</h2>
          <p>{error}</p>
          <button onClick={fetchReportData}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-container">
      {/* Modern Navigation Header */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="logo">
            <span className="logo-text">MONIVUE</span>
          </div>
        </div>
        <div className="nav-actions">
          <div className="nav-links">
            <button 
              className="nav-link"
              onClick={() => navigate('/home')}
            >
              <span className="nav-icon">🏠</span>{' '}
              <span>Home</span>
            </button>
            <button 
              className="nav-link"
              onClick={() => navigate('/transactions')}
            >
              <span className="nav-icon">💰</span>{' '}
              <span>Transactions</span>
            </button>
            <button 
              className="nav-link"
              onClick={() => navigate('/budgets')}
            >
              <span className="nav-icon">📊</span>{' '}
              <span>Budgets</span>
            </button>
            <button 
              className="nav-link"
              onClick={() => navigate('/goals')}
            >
              <span className="nav-icon">🎯</span>{' '}
              <span>Goals</span>
            </button>
            <button 
              className="nav-link active"
              onClick={() => navigate('/reports')}
            >
              <span className="nav-icon">📈</span>{' '}
              <span>Reports</span>
            </button>
          </div>
          <div className="user-info">
            <div className="user-details">
              <span className="user-greeting">{getTimeOfDayGreeting()}, {user?.name}!</span>
              <div className="current-time">{currentTime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</div>
            </div>
          </div>
          
          {/* Profile Dropdown */}
          <div className="profile-container">
            <button 
              className="profile-button"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            >
              <div className="profile-avatar">
                <span className="avatar-text">{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <span className="profile-chevron">▼</span>
            </button>
            
            {showProfileDropdown && (
              <div className="profile-dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">
                    <span className="dropdown-avatar-text">{user?.name?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="dropdown-info">
                    <span className="dropdown-name">{user?.name}</span>
                    <span className="dropdown-email">{user?.email}</span>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button onClick={() => alert('Edit Profile feature coming soon!')} className="dropdown-item">
                  <span className="dropdown-icon">⚙️</span>
                  <span>Edit Profile</span>
                </button>
                <button onClick={handleOpenNotifications} className="dropdown-item">
                  <span className="dropdown-icon">🔔</span>
                  <span>Email Notifications</span>
                </button>
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item logout">
                  <span className="dropdown-icon">⏻</span>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Reports Header */}
      <div className="reports-header">
        <h1 className="reports-title">📊 Reports & Analytics</h1>
        <p className="reports-subtitle">
          {getTimeOfDayGreeting()}, {user?.name}! Comprehensive financial analysis for better decision making.
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="date-range-selector">
        <button 
          className={`date-range-btn ${dateRange === '30d' ? 'active' : ''}`}
          onClick={() => setDateRange('30d')}
        >
          Last 30 Days
        </button>
        <button 
          className={`date-range-btn ${dateRange === '90d' ? 'active' : ''}`}
          onClick={() => setDateRange('90d')}
        >
          Last 90 Days
        </button>
        <button 
          className={`date-range-btn ${dateRange === '12m' ? 'active' : ''}`}
          onClick={() => setDateRange('12m')}
        >
          Last 12 Months
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="reports-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📈 Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          📊 Charts & Graphs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📄 Export Reports
        </button>
      </div>

      {/* Main Content */}
      <div className="reports-content">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Summary Cards */}
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-card-icon">💰</div>
                <div className="summary-card-title">Total Income</div>
                <div className="summary-card-value">{formatCurrency(reportData?.summary?.totalIncome || 0)}</div>
                <div className="summary-card-change positive">+12.5% vs last period</div>
              </div>
              <div className="summary-card">
                <div className="summary-card-icon">💸</div>
                <div className="summary-card-title">Total Expenses</div>
                <div className="summary-card-value">{formatCurrency(reportData?.summary?.totalExpenses || 0)}</div>
                <div className="summary-card-change negative">+5.2% vs last period</div>
              </div>
              <div className="summary-card">
                <div className="summary-card-icon">💎</div>
                <div className="summary-card-title">Net Savings</div>
                <div className="summary-card-value">{formatCurrency(reportData?.summary?.netSavings || 0)}</div>
                <div className="summary-card-change positive">+18.3% vs last period</div>
              </div>
              <div className="summary-card">
                <div className="summary-card-icon">📊</div>
                <div className="summary-card-title">Savings Rate</div>
                <div className="summary-card-value">{Number(reportData?.summary?.savingsRate || 0).toFixed(1)}%</div>
                <div className="summary-card-change positive">+2.1% vs last period</div>
              </div>
            </div>

            {/* Budget Performance */}
            <div className="chart-card">
              <div className="chart-title">🎯 Budget Performance</div>
              <div className="chart-content">
                <div className="budget-performance">
                  {reportData?.budgetPerformance?.length > 0 ? (
                    reportData.budgetPerformance.map((budget) => {
                      const spentPercentage = budget.budgeted > 0 ? 
                        Math.min((budget.spent / budget.budgeted) * 100, 100) : 0;
                      
                      return (
                        <div key={`${budget.category || 'budget'}-${budget.status}-${budget.budgeted || 0}-${budget.spent || 0}`} className={`budget-item ${budget.status}`}>
                          <div className="budget-category">{budget.category || 'Unknown Category'}</div>
                          <div className="budget-bars">
                            <div className="budget-bar budgeted">
                              <span>Budgeted: {budget.status === 'no-budget' ? 'Not Set' : formatCurrency(budget.budgeted || 0)}</span>
                            </div>
                            <div 
                              className={`budget-bar spent ${budget.status === 'no-budget' ? 'no-budget' : ''}`}
                              style={{ width: budget.status === 'no-budget' ? '100%' : `${spentPercentage}%` }}
                            >
                              <span>Spent: {formatCurrency(budget.spent || 0)}</span>
                            </div>
                          </div>
                          <div className={`budget-status ${budget.status}`}>
                            {getBudgetStatusLabel(budget.status)}
                            <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>
                              {getBudgetStatusMeta(budget.status, spentPercentage)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-data-message">
                      <div className="no-data-icon">🎯</div>
                      <h4>No Budget Performance Data</h4>
                      <p>Create budgets and track expenses to see your budget performance!</p>
                      <button onClick={() => navigate('/budgets')} className="add-data-btn">
                        Create Budget
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Investment Predictions Card */}
            <div className="chart-card investment-prediction-card">
              <div className="chart-title">🤖 AI Investment Predictions</div>
              <div className="investment-subtitle">
                Personalized investment recommendations based on your income and savings
              </div>
              <div className="chart-content">
                {renderInvestmentPredictions()}
              </div>
            </div>
          </div>
        )}

        {/* Charts Tab */}
        {activeTab === 'charts' && (
          <div className="charts-tab">
            {/* Income vs Expenses Trend */}
            <div className="chart-card">
              <div className="chart-title">📈 Income vs Expenses Trend</div>
              <div className="chart-content">
                <div className="trend-chart">
                  {reportData?.monthlyTrends?.length > 0 ? (
                    reportData.monthlyTrends.map((trend, index) => {
                      const maxAmount = Math.max(
                        ...reportData.monthlyTrends.map(t => Math.max(t.income || 0, t.expenses || 0))
                      );
                      const incomeHeight = maxAmount > 0 ? ((trend.income || 0) / maxAmount) * 200 : 0;
                      const expensesHeight = maxAmount > 0 ? ((trend.expenses || 0) / maxAmount) * 200 : 0;
                      
                      return (
                        <div key={`${trend.month || 'month'}-${trend.income || 0}-${trend.expenses || 0}`} className="trend-bar-group">
                          <div className="trend-bars">
                            <div 
                              className="trend-bar income" 
                              style={{ height: `${incomeHeight}px` }}
                              title={`Income: ${formatCurrency(trend.income || 0)}`}
                            >
                              <span className="bar-label">Income: {formatCurrency(trend.income || 0)}</span>
                            </div>
                            <div 
                              className="trend-bar expenses" 
                              style={{ height: `${expensesHeight}px` }}
                              title={`Expenses: ${formatCurrency(trend.expenses || 0)}`}
                            >
                              <span className="bar-label">Expenses: {formatCurrency(trend.expenses || 0)}</span>
                            </div>
                          </div>
                          <div className="trend-month">{trend.month}</div>
                          <div className="trend-net" style={{ color: (trend.savings || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                            Net: {formatCurrency(trend.savings || 0)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-data-message">
                      <div className="no-data-icon">📊</div>
                      <h4>No Transaction Data</h4>
                      <p>Start by adding some transactions to see your financial trends!</p>
                      <button onClick={() => navigate('/transactions')} className="add-data-btn">
                        Add Transactions
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Legend */}
                {reportData?.monthlyTrends?.length > 0 && (
                  <div className="chart-legend">
                    <div className="legend-item">
                      <div className="legend-color income"></div>
                      <span>Income</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color expenses"></div>
                      <span>Expenses</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Category Spending Breakdown */}
            <div className="chart-card">
              <div className="chart-title">🏷️ Category Spending Breakdown</div>
              <div className="chart-content">
                {reportData?.categoryBreakdown?.length > 0 ? (
                  <div className="category-chart-container">
                    {/* Pie Chart Visualization */}
                    <div className="category-pie-chart">
                      <div className="pie-chart-wrapper">
                        <div className="pie-center">
                          <div className="pie-total">{formatCurrency(reportData.summary?.totalExpenses || 0)}</div>
                          <div className="pie-label">Total Spent</div>
                        </div>
                      </div>
                    </div>

                    {/* Category List */}
                    <div className="category-list">
                      {reportData.categoryBreakdown.slice(0, 6).map((category, index) => {
                        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
                        const maxAmount = Math.max(...reportData.categoryBreakdown.map(c => c.amount));
                        const fillPercentage = maxAmount > 0 ? (category.amount / maxAmount) * 100 : 0;
                        
                        return (
                          <div key={`${category.name || category.category || 'category'}-${category.amount || 0}-${category.percentage || 0}`} className="category-item">
                            <div className="category-dot" style={{ backgroundColor: colors[index % colors.length] }}></div>
                            <div className="category-info">
                              <div className="category-name">{category.name || category.category || 'Unknown Category'}</div>
                              <div className="category-stats">
                                <span className="category-amount">{formatCurrency(category.amount || 0)}</span>
                                <span className="category-percentage">{typeof category.percentage === 'number' ? category.percentage.toFixed(1) : (category.percentage || '0.0')}%</span>
                              </div>
                            </div>
                            <div className="category-bar">
                              <div 
                                className="category-fill" 
                                style={{ 
                                  width: `${fillPercentage}%`,
                                  backgroundColor: colors[index % colors.length]
                                }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="no-data-message">
                    <div className="no-data-icon">🏷️</div>
                    <h4>No Category Data</h4>
                    <p>Add expense transactions with categories to see the breakdown!</p>
                    <button onClick={() => navigate('/transactions')} className="add-data-btn">
                      Add Expenses
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Savings Growth Tracker */}
            <div className="chart-card">
              <div className="chart-title">💎 Savings Growth Tracker</div>
              <div className="chart-content">
                <div className="savings-chart-container">
                  <div className="savings-chart">
                    {reportData?.monthlyTrends?.length > 0 ? (
                      reportData.monthlyTrends.map((trend, index) => {
                        const savings = (trend.income || 0) - (trend.expenses || 0);
                        const maxAmount = Math.max(
                          ...reportData.monthlyTrends.map(t => Math.abs((t.income || 0) - (t.expenses || 0)))
                        );
                        const dotPosition = maxAmount > 0 ? 
                          ((savings + maxAmount) / (2 * maxAmount)) * 100 : 50;
                        
                        return (
                          <div key={`${trend.month || 'month'}-${trend.income || 0}-${trend.expenses || 0}-${savings}`} className="savings-point">
                            <div className="savings-line" style={{ height: `${100 - dotPosition}%` }}>
                              <div className="savings-dot-container" style={{ bottom: `${dotPosition}%` }}>
                                <div className={`savings-dot ${savings >= 0 ? 'positive' : 'negative'}`}>
                                  <div className="savings-tooltip">
                                    <div className="tooltip-amount">{formatCurrency(Math.abs(savings))}</div>
                                    <div className={`tooltip-trend ${savings >= 0 ? 'trend-up' : 'trend-down'}`}>
                                      {savings >= 0 ? '↗️ Saved' : '↘️ Deficit'}
                                      {index > 0 && (
                                        <>
                                          <br />
                                          {Math.abs(((savings - reportData.monthlyTrends[index - 1].savings) / Math.abs(reportData.monthlyTrends[index - 1].savings || 1)) * 100).toFixed(1)}%
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="savings-month">{trend.month}</div>
                            <div className={`savings-value ${savings >= 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(savings)}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-data-message">
                        <div className="no-data-icon">💎</div>
                        <h4>No Savings Data</h4>
                        <p>Track your income and expenses to see savings growth!</p>
                        <button onClick={() => navigate('/transactions')} className="add-data-btn">
                          Start Tracking
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Savings Summary */}
                  {reportData?.monthlyTrends?.length > 0 && (
                    <div className="savings-summary">
                      <div className="summary-stat">
                        <div className="stat-label">Total Saved</div>
                        <div className={`stat-value ${(reportData.summary?.netSavings || 0) >= 0 ? 'positive' : ''}`}>
                          {formatCurrency(reportData.summary?.netSavings || 0)}
                        </div>
                      </div>
                      <div className="summary-stat">
                        <div className="stat-label">Average Monthly</div>
                        <div className="stat-value">
                          {formatCurrency((reportData.summary?.netSavings || 0) / (reportData.monthlyTrends?.length || 1))}
                        </div>
                      </div>
                      <div className="summary-stat">
                        <div className="stat-label">Best Month</div>
                        <div className="stat-value positive">
                          {formatCurrency(Math.max(...reportData.monthlyTrends.map(t => (t.income || 0) - (t.expenses || 0))))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export Reports Tab */}
        {activeTab === 'export' && (
          <div className="export-tab">
            <div className="export-section">
              <div className="export-title">📄 Export Financial Reports</div>
              <div className="export-description">
                Generate comprehensive reports for personal record keeping, tax preparation, or financial analysis.
              </div>
              
              <div className="export-options">
                <div className="export-card">
                  <div className="export-icon">📄</div>
                  <h3>PDF Report</h3>
                  <p>Comprehensive financial summary with charts and analysis. Perfect for sharing with advisors or personal records.</p>
                  <button className="export-btn primary" onClick={downloadPDF}>
                    📄 Download PDF Report
                  </button>
                </div>
                
                <div className="export-card">
                  <div className="export-icon">📊</div>
                  <h3>Excel Spreadsheet</h3>
                  <p>Raw financial data in spreadsheet format. Ideal for detailed analysis and custom calculations.</p>
                  <button className="export-btn secondary" onClick={downloadExcel}>
                    📊 Export Excel Data
                  </button>
                </div>
                
                <div className="export-card">
                  <div className="export-icon">📈</div>
                  <h3>Financial Summary</h3>
                  <p>Quick overview report with key metrics. Great for monthly reviews.</p>
                  <button className="export-btn" onClick={generateSummary}>
                    📈 Generate Summary
                  </button>
                </div>
              </div>

              <div className="export-info">
                <h4>💡 Export Tips:</h4>
                <ul>
                  <li>PDF reports include all charts and visual analysis</li>
                  <li>Excel files contain raw transaction data for custom analysis</li>
                  <li>Reports include data for the selected time period: {getPeriodText(dateRange)}</li>
                  <li>All exported data is formatted for easy sharing and analysis</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Reports;