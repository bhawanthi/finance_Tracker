import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserData, clearAuthData, formatCurrency } from '../utils/auth';
import TransactionModal from './TransactionModal';
import './styles/Home.css';
import { sendNotificationEmail } from '../utils/sendEmail';

const Home = () => {
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [transactionStats, setTransactionStats] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [goalsData, setGoalsData] = useState([]);
  const [budgetsData, setBudgetsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    monthlySalary: '',
    currency: 'USD',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [notificationSettings, setNotificationSettings] = useState({
    enabled: false,
    email: '',
    frequency: 'weekly',
    includeSalaryTips: true,
    includeGoals: true,
    includeBudgets: true
  });
  const navigate = useNavigate();
  const location = useLocation();

  const trimmedName = user?.name?.trim();
  const emailPrefix = user?.email?.split('@')[0];
  const displayName = trimmedName || emailPrefix || 'User';

  const avatarInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';

  const handleCloseEditProfile = useCallback(() => {
    setShowEditProfile(false);
    // Reset form when closing
    setEditFormData({
      name: user?.name || '',
      email: user?.email || '',
      monthlySalary: user?.monthlySalary || '',
      currency: user?.currency || 'USD',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  }, [user]);

  useEffect(() => {
    const userData = getUserData();
    if (userData) {
      setUser(userData);
      setEditFormData({
        name: userData.name || '',
        email: userData.email || '',
        monthlySalary: userData.monthlySalary || '',
        currency: userData.currency || 'USD',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }

    // Fetch transaction stats
    fetchTransactionStats();

    // Fetch recent transactions
    fetchRecentTransactions();

    // Fetch goals
    fetchGoals();

    // Fetch budgets
    fetchBudgets();

    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    // Close profile dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (location.state?.openNotifications) {
      setShowNotificationModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Handle escape key separately
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        if (showEditProfile) {
          handleCloseEditProfile();
        }
        if (showProfileDropdown) {
          setShowProfileDropdown(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [showEditProfile, showProfileDropdown, handleCloseEditProfile]);

  const fetchTransactionStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/stats?period=monthly', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactionStats(data);
      } else {
        console.error('Failed to fetch transaction stats');
      }
    } catch (error) {
      console.error('Error fetching transaction stats:', error);
    }
  };

  const handleLogout = () => {
    clearAuthData();
    navigate('/login');
  };

  const getTimeOfDayGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Helper functions to calculate totals
  const getTotalIncome = () => {
    if (!transactionStats || !transactionStats.totals) return 0;
    const incomeTotal = transactionStats.totals.find(t => t._id === 'income');
    const baseSalary = user?.monthlySalary || 0;
    const additionalIncome = incomeTotal?.total || 0;
    return baseSalary + additionalIncome;
  };

  const getTotalExpenses = () => {
    if (!transactionStats || !transactionStats.totals) return 0;
    const expenseTotal = transactionStats.totals.find(t => t._id === 'expense');
    return expenseTotal?.total || 0;
  };

  const getTotalBalance = () => {
    return getTotalIncome() - getTotalExpenses();
  };

  const getBalanceChange = () => {
    // Calculate percentage change based on previous period
    const currentBalance = getTotalBalance();
    const baseIncome = user?.monthlySalary || 0;
    if (baseIncome === 0) return 0;
    return ((currentBalance - baseIncome) / baseIncome * 100).toFixed(1);
  };

  const fetchRecentTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions?limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/goals', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGoalsData(data);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const fetchBudgets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/budgets', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBudgetsData(data);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
    }
  };

  const refreshData = () => {
    setLoading(true);
    Promise.all([
      fetchTransactionStats(),
      fetchRecentTransactions(),
      fetchGoals(),
      fetchBudgets()
    ]).finally(() => setLoading(false));
  };

  const handleEditProfile = () => {
    setShowProfileDropdown(false);
    setShowEditProfile(true);
  };

  // Fetch notification settings
  const fetchNotificationSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotificationSettings({
          enabled: data.enabled || false,
          email: data.email || user?.email || '',
          frequency: data.frequency || 'weekly',
          includeSalaryTips: data.includeSalaryTips !== undefined ? data.includeSalaryTips : true,
          includeGoals: data.includeGoals !== undefined ? data.includeGoals : true,
          includeBudgets: data.includeBudgets !== undefined ? data.includeBudgets : true
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
  };

  // Open notification modal and fetch settings
  useEffect(() => {
    if (showNotificationModal && user) {
      fetchNotificationSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotificationModal, user]);

  // Save notification settings
  const handleSaveNotificationSettings = async () => {
    try {
      // Validate email if notifications are enabled
      if (notificationSettings.enabled) {
        if (!notificationSettings.email || !notificationSettings.email.includes('@')) {
          alert('⚠️ Please enter a valid email address');
          return;
        }
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notificationSettings)
      });

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : { msg: await response.text() };
      
      if (response.ok) {
        alert('✅ Notification settings saved successfully!');
        setShowNotificationModal(false);
      } else {
        const errorDetail = data.error ? ` (${data.error})` : '';
        alert(`❌ Failed to save: ${data.msg || 'Unknown error'}${errorDetail}`);
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      alert('❌ Error saving notification settings. Please check your connection.');
    }
  };

  // Send test email
  const handleSendTestEmail = async () => {
    if (notificationSettings.enabled && (!notificationSettings.email || !notificationSettings.email.includes('@'))) {
      alert('⚠️ Please enter a valid email address first');
      return;
    }
    const toNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    // Build professional AI-powered content from real API fields
    const baseSalary = toNumber(user?.monthlySalary);
    let salaryTips = '';
    if (notificationSettings.includeSalaryTips) {
      salaryTips = `Your base salary is ${formatCurrency(baseSalary)}. AI recommends the 50/30/20 rule: ${formatCurrency(baseSalary * 0.5)} for essentials, ${formatCurrency(baseSalary * 0.3)} for goals, ${formatCurrency(baseSalary * 0.2)} for savings.`;
    }

    let goalsSummary = '';
    if (notificationSettings.includeGoals) {
      goalsSummary = goalsData?.length
        ? goalsData.map((goal) => {
          const currentAmount = toNumber(goal.currentAmount);
          const targetAmount = toNumber(goal.targetAmount);
          const progress = targetAmount > 0
            ? Math.min((currentAmount / targetAmount) * 100, 100)
            : toNumber(goal.progressPercentage);

          return `• ${goal.name || 'Goal'}: ${progress.toFixed(1)}% complete (${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)})`;
        }).join('\n')
        : 'No goals set yet. Start by adding a financial goal!';
    }

    let budgetsSummary = '';
    if (notificationSettings.includeBudgets) {
      budgetsSummary = budgetsData?.length
        ? budgetsData.map((budget) => {
          const spent = toNumber(budget.spent);
          const allocated = toNumber(budget.amount);
          return `• ${budget.category || budget.name || 'Budget'}: ${formatCurrency(spent)} spent of ${formatCurrency(allocated)}`;
        }).join('\n')
        : 'No budgets set yet. Create a budget to track your spending!';
    }

    try {
      await sendNotificationEmail({
        email: notificationSettings.email,
        name: user?.name || 'User',
        salaryTips,
        goals: goalsSummary,
        budgets: budgetsSummary,
        message: 'This is your AI-powered finance notification from MoneyVue.'
      });
      alert('✅ Test email sent successfully! Check your inbox.');
    } catch (error) {
      alert('❌ Failed to send test email: ' + (error?.text || error?.message || 'Unknown error'));
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    // Validate name and email (required)
    if (!editFormData.name?.trim() || !editFormData.email?.trim()) {
      alert('Name and email are required');
      return;
    }
    
    // Validate password fields ONLY if user starts changing password
    if (editFormData.newPassword) {
      if (!editFormData.currentPassword) {
        alert('Current password is required to change password');
        return;
      }
      if (editFormData.newPassword !== editFormData.confirmPassword) {
        alert('New passwords do not match');
        return;
      }
      if (editFormData.newPassword.length < 6) {
        alert('New password must be at least 6 characters long');
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const requestData = {
        name: editFormData.name,
        email: editFormData.email,
        monthlySalary: editFormData.monthlySalary,
        currency: editFormData.currency || 'USD'
      };

      // Include password fields only if user wants to change password
      if (editFormData.newPassword) {
        requestData.currentPassword = editFormData.currentPassword;
        requestData.newPassword = editFormData.newPassword;
      }

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser.user);
        localStorage.setItem('user', JSON.stringify(updatedUser.user));
        setShowEditProfile(false);
        // Reset form
        setEditFormData({
          name: updatedUser.user.name || '',
          email: updatedUser.user.email || '',
          monthlySalary: updatedUser.user.monthlySalary || '',
          currency: updatedUser.user.currency || 'USD',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        alert('Profile updated successfully!');
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('An error occurred while updating profile');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleProfileDropdown = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  if (loading) {
    return (
      <div className="home-container">
        <div className="loading-dashboard">
          <div className="loading-spinner"></div>
          <p>Loading your financial dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
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
              className="nav-link active"
              onClick={() => navigate('/home')}
            >
              <span className="nav-icon">🏠</span>
              Home
            </button>
            <button 
              className="nav-link"
              onClick={() => navigate('/transactions')}
            >
              <span className="nav-icon">💰</span>
              Transactions
            </button>
            <button 
              className="nav-link"
              onClick={() => navigate('/budgets')}
            >
              <span className="nav-icon">📊</span>
              Budgets
            </button>
            <button 
              className="nav-link"
              onClick={() => navigate('/goals')}
            >
              <span className="nav-icon">🎯</span>
              Goals
            </button>
            <button 
              className="nav-link"
              onClick={() => navigate('/reports')}
            >
              <span className="nav-icon">📈</span>
              Reports
            </button>
          </div>
          <div className="user-info">
            <div className="user-details">
              <span className="user-greeting">{getTimeOfDayGreeting()}, {displayName}!</span>
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
              onClick={toggleProfileDropdown}
              className={`profile-button ${showProfileDropdown ? 'open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={showProfileDropdown}
              aria-label="Open profile menu"
            >
              <div className="profile-avatar">
                <span className="avatar-text">{avatarInitials}</span>
              </div>
              <span className="profile-chevron">▼</span>
            </button>
            
            {showProfileDropdown && (
              <div className="profile-dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">
                    <span className="dropdown-avatar-text">{avatarInitials}</span>
                  </div>
                  <div className="dropdown-info">
                    <span className="dropdown-name">{displayName}</span>
                    <span className="dropdown-email">{user.email}</span>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button onClick={handleEditProfile} className="dropdown-item">
                  <span className="dropdown-icon">⚙️</span>
                  <span>Edit Profile</span>
                </button>
                <button onClick={() => setShowNotificationModal(true)} className="dropdown-item">
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

      {/* Hero Dashboard */}
      <section className="hero-dashboard">
        <div className="hero-content">
          <h1 className="hero-title">Financial Dashboard</h1>
          <p className="hero-subtitle">Your complete financial overview at a glance</p>
          
          {/* Key Metrics */}
          <div className="key-metrics">
            <div className="metric-card balance">
              <div className="metric-icon">💰</div>
              <div className="metric-info">
                <h3>Total Balance</h3>
                <span className="metric-value">{formatCurrency(getTotalBalance())}</span>
                <span className={`metric-change ${getTotalBalance() >= (user?.monthlySalary || 0) ? 'positive' : 'negative'}`}>
                  {getTotalBalance() >= (user?.monthlySalary || 0) ? '+' : ''}{getBalanceChange()}% this month
                </span>
              </div>
            </div>
            <div className="metric-card income">
              <div className="metric-icon">📈</div>
              <div className="metric-info">
                <h3>Monthly Income</h3>
                <span className="metric-value">{formatCurrency(getTotalIncome())}</span>
                <span className="metric-change neutral">
                  {transactionStats?.totals?.find(t => t._id === 'income')?.total > 0 ? 
                    `Salary + ${formatCurrency(transactionStats.totals.find(t => t._id === 'income').total)} additional` : 
                    'Regular salary'
                  }
                </span>
              </div>
            </div>
            <div className="metric-card expenses">
              <div className="metric-icon">📊</div>
              <div className="metric-info">
                <h3>Monthly Expenses</h3>
                <span className="metric-value">{formatCurrency(getTotalExpenses())}</span>
                <span className="metric-change neutral">
                  {getTotalExpenses() > 0 ? 
                    `${transactionStats?.totals?.find(t => t._id === 'expense')?.count || 0} transactions` : 
                    'Start tracking'
                  }
                </span>
              </div>
            </div>
            <div className="metric-card savings">
              <div className="metric-icon">🎯</div>
              <div className="metric-info">
                <h3>Savings Goal</h3>
                <span className="metric-value">{formatCurrency(0)}</span>
                <span className="metric-change neutral">Set your goal</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="main-content">
        {/* Financial Insights */}
        <section className="insights-section">
          <h2 className="section-title">Financial Insights</h2>
          
          <div className="insights-grid">
            {/* Spending Overview */}
            <div className="insight-card spending-overview">
              <h3>💳 Spending This Month</h3>
              <div className="spending-chart">
                <div className="chart-placeholder">
                  <div className="chart-circle">
                    <span className="chart-value">{formatCurrency(getTotalExpenses())}</span>
                    <span className="chart-label">Total Spent</span>
                  </div>
                </div>
                <div className="spending-categories">
                  {transactionStats?.categoryBreakdown
                    ?.filter(cat => cat._id.type === 'expense')
                    ?.slice(0, 4)
                    ?.map(cat => (
                      <div key={cat._id.category} className="category-item">
                        <span className="category-dot food"></span>
                        <span className="category-name">{cat._id.category}</span>
                        <span className="category-amount">{formatCurrency(cat.total)}</span>
                      </div>
                    )) ||
                    [
                      { name: 'Food & Dining', amount: 0 },
                      { name: 'Transportation', amount: 0 },
                      { name: 'Utilities', amount: 0 },
                      { name: 'Entertainment', amount: 0 }
                    ].map(cat => (
                      <div key={cat.name} className="category-item">
                        <span className="category-dot food"></span>
                        <span className="category-name">{cat.name}</span>
                        <span className="category-amount">{formatCurrency(cat.amount)}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* Market Trends */}
            <div className="insight-card market-trends">
              <h3>📈 Market & Inflation Trends</h3>
              <div className="trend-list">
                <div className="trend-item">
                  <div className="trend-info">
                    <span className="trend-category">🍕 Food & Groceries</span>
                    <span className="trend-description">Price increases affecting budget</span>
                  </div>
                  <span className="trend-value up">+3.2%</span>
                </div>
                <div className="trend-item">
                  <div className="trend-info">
                    <span className="trend-category">⛽ Transportation</span>
                    <span className="trend-description">Fuel costs trending upward</span>
                  </div>
                  <span className="trend-value up">+2.8%</span>
                </div>
                <div className="trend-item">
                  <div className="trend-info">
                    <span className="trend-category">🏠 Housing</span>
                    <span className="trend-description">Rent and utilities rising</span>
                  </div>
                  <span className="trend-value up">+4.1%</span>
                </div>
                <div className="trend-item">
                  <div className="trend-info">
                    <span className="trend-category">💡 Utilities</span>
                    <span className="trend-description">Stable pricing this quarter</span>
                  </div>
                  <span className="trend-value stable">+0.5%</span>
                </div>
              </div>
            </div>

            {/* Financial Goals */}
            <div className="insight-card goals-progress">
              <h3>🎯 Financial Goals Progress</h3>
              <div className="goals-list">
                {goalsData.length > 0 ? (
                  goalsData.map(goal => {
                    const progress = goal.targetAmount > 0 ? ((goal.currentAmount || 0) / goal.targetAmount * 100) : 0;
                    return (
                      <div key={goal._id} className="goal-item">
                        <div className="goal-header">
                          <span className="goal-name">{goal.title}</span>
                          <span className="goal-target">
                            {formatCurrency(goal.currentAmount || 0)} / {formatCurrency(goal.targetAmount)}
                          </span>
                        </div>
                        <div className="goal-progress">
                          <div className="progress-bar">
                            <div className="progress-fill" style={{width: `${Math.min(progress, 100)}%`}}></div>
                          </div>
                          <span className="progress-percent">{Math.round(progress)}%</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="no-goals">
                    <p>No goals created yet.</p>
                    <p style={{fontSize: '0.9em', color: '#666', marginTop: '10px'}}>
                      Create your first financial goal to start tracking your progress!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="insight-card recent-activity">
              <h3>📋 Recent Activity</h3>
              <div className="activity-list">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map(transaction => (
                    <div key={transaction._id} className="activity-item">
                      <div className="activity-icon">
                        {transaction.type === 'income' ? '💰' : '💸'}
                      </div>
                      <div className="activity-details">
                        <div className="activity-description">{transaction.description}</div>
                        <div className="activity-meta">
                          <span className="activity-category">{transaction.category}</span>
                          <span className="activity-date">
                            {new Date(transaction.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                      </div>
                      <div className={`activity-amount ${transaction.type}`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="activity-placeholder">
                    <div className="placeholder-icon">💼</div>
                    <div className="placeholder-text">
                      <h4>No transactions yet</h4>
                      <p>Start by adding your first income or expense to see your activity here.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Transaction Modals */}
      <TransactionModal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        type="income"
        onSuccess={() => {
          // Refresh data after successful transaction
          refreshData();
        }}
      />

      <TransactionModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        type="expense"
        onSuccess={() => {
          // Refresh data after successful transaction
          refreshData();
        }}
      />

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal-overlay" onClick={handleCloseEditProfile}>
          <div className="edit-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Profile</h2>
              <button 
                className="close-button" 
                onClick={handleCloseEditProfile}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="edit-profile-form">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={editFormData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="monthlySalary">Monthly Salary</label>
                <input
                  type="number"
                  id="monthlySalary"
                  name="monthlySalary"
                  value={editFormData.monthlySalary}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="currency">💱 Preferred Currency</label>
                <select
                  id="currency"
                  name="currency"
                  value={editFormData.currency}
                  onChange={handleInputChange}
                  required
                >
                  <option value="USD">🇺🇸 USD - US Dollar</option>
                  <option value="EUR">🇪🇺 EUR - Euro</option>
                  <option value="GBP">🇬🇧 GBP - British Pound</option>
                  <option value="JPY">🇯🇵 JPY - Japanese Yen</option>
                  <option value="CNY">🇨🇳 CNY - Chinese Yuan</option>
                  <option value="INR">🇮🇳 INR - Indian Rupee</option>
                  <option value="CAD">🇨🇦 CAD - Canadian Dollar</option>
                  <option value="AUD">🇦🇺 AUD - Australian Dollar</option>
                  <option value="CHF">🇨🇭 CHF - Swiss Franc</option>
                  <option value="MXN">🇲🇽 MXN - Mexican Peso</option>
                  <option value="BRL">🇧🇷 BRL - Brazilian Real</option>
                  <option value="ZAR">🇿🇦 ZAR - South African Rand</option>
                  <option value="SGD">🇸🇬 SGD - Singapore Dollar</option>
                  <option value="HKD">🇭🇰 HKD - Hong Kong Dollar</option>
                  <option value="KRW">🇰🇷 KRW - South Korean Won</option>
                  <option value="SEK">🇸🇪 SEK - Swedish Krona</option>
                  <option value="NOK">🇳🇴 NOK - Norwegian Krone</option>
                  <option value="DKK">🇩🇰 DKK - Danish Krone</option>
                  <option value="PLN">🇵🇱 PLN - Polish Zloty</option>
                  <option value="THB">🇹🇭 THB - Thai Baht</option>
                  <option value="MYR">🇲🇾 MYR - Malaysian Ringgit</option>
                  <option value="IDR">🇮🇩 IDR - Indonesian Rupiah</option>
                  <option value="PHP">🇵🇭 PHP - Philippine Peso</option>
                  <option value="TRY">🇹🇷 TRY - Turkish Lira</option>
                  <option value="RUB">🇷🇺 RUB - Russian Ruble</option>
                  <option value="AED">🇦🇪 AED - UAE Dirham</option>
                  <option value="SAR">🇸🇦 SAR - Saudi Riyal</option>
                  <option value="EGP">🇪🇬 EGP - Egyptian Pound</option>
                  <option value="NGN">🇳🇬 NGN - Nigerian Naira</option>
                  <option value="KES">🇰🇪 KES - Kenyan Shilling</option>
                  <option value="LKR">🇱🇰 LKR - Sri Lankan Rupee</option>
                </select>
              </div>

              <div className="password-section">
                <div className="password-header">
                  <h3>🔒 Change Password</h3>
                  <span className="password-optional">(Optional)</span>
                </div>
                <div className="password-info">
                  <p>Update your password to keep your account secure</p>
                </div>

                <div className="form-group">
                  <label htmlFor="currentPassword">
                    <span className="label-icon">🔐</span>
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    value={editFormData.currentPassword}
                    onChange={handleInputChange}
                    placeholder="Enter current password"
                    className="password-input"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="newPassword">
                    <span className="label-icon">🆕</span>
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={editFormData.newPassword}
                    onChange={handleInputChange}
                    placeholder="Enter new password (min 6 characters)"
                    minLength="6"
                    className="password-input"
                  />
                  {editFormData.newPassword && (
                    <div className="password-strength">
                      <span className={`strength-indicator ${
                        editFormData.newPassword.length >= 8 ? 'strong' : 
                        editFormData.newPassword.length >= 6 ? 'medium' : 'weak'
                      }`}>
                        {editFormData.newPassword.length >= 8 ? '💪 Strong' : 
                         editFormData.newPassword.length >= 6 ? '👍 Good' : '⚠️ Weak'}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="confirmPassword">
                    <span className="label-icon">✅</span>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={editFormData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm new password"
                    className="password-input"
                  />
                  {editFormData.confirmPassword && (
                    <div className="password-match">
                      <span className={`match-indicator ${
                        editFormData.newPassword === editFormData.confirmPassword ? 'match' : 'no-match'
                      }`}>
                        {editFormData.newPassword === editFormData.confirmPassword ? 
                          '✅ Passwords match' : '❌ Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="password-requirements">
                  <h4>Password Requirements:</h4>
                  <ul>
                    <li className={editFormData.newPassword?.length >= 6 ? 'requirement-met' : ''}>
                      Minimum 6 characters
                    </li>
                    <li className={/[A-Z]/.test(editFormData.newPassword) ? 'requirement-met' : ''}>
                      At least one uppercase letter (recommended)
                    </li>
                    <li className={/[0-9]/.test(editFormData.newPassword) ? 'requirement-met' : ''}>
                      At least one number (recommended)
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={handleCloseEditProfile}
                >
                  Cancel
                </button>
                <button type="submit" className="save-button">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationModal && (
        <div className="modal-overlay" onClick={() => setShowNotificationModal(false)}>
          <div className="notification-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔔 Email Notifications</h2>
              <button 
                className="close-button" 
                onClick={() => setShowNotificationModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="notification-content">
              <div className="notification-info">
                <p>Receive personalized financial insights and reminders directly to your email.</p>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <span className="toggle-text">Enable Email Notifications</span>
                  <input
                    type="checkbox"
                    checked={notificationSettings.enabled}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      enabled: e.target.checked
                    })}
                    className="toggle-checkbox"
                  />
                  <span className="toggle-switch"></span>
                </label>
              </div>

              {notificationSettings.enabled && (
                <>
                  <div className="form-group">
                    <label htmlFor="notif-email">📧 Email Address</label>
                    <input
                      type="email"
                      id="notif-email"
                      value={notificationSettings.email}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        email: e.target.value
                      })}
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="frequency">📅 Frequency</label>
                    <select
                      id="frequency"
                      value={notificationSettings.frequency}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        frequency: e.target.value
                      })}
                      className="frequency-select"
                    >
                      <option value="daily">Daily - Every morning at 8 AM</option>
                      <option value="weekly">Weekly - Every Monday at 8 AM</option>
                      <option value="monthly">Monthly - 1st of each month at 8 AM</option>
                    </select>
                  </div>

                  <div className="notification-options">
                    <h3>📊 Include in Email</h3>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={notificationSettings.includeSalaryTips}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            includeSalaryTips: e.target.checked
                          })}
                        />
                        <span>💰 Salary Management Tips</span>
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={notificationSettings.includeGoals}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            includeGoals: e.target.checked
                          })}
                        />
                        <span>🎯 Goal Progress Updates</span>
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={notificationSettings.includeBudgets}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            includeBudgets: e.target.checked
                          })}
                        />
                        <span>📈 Budget Status Alerts</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowNotificationModal(false)}
                >
                  Cancel
                </button>
                {notificationSettings.enabled && (
                  <button 
                    type="button"
                    className="test-button"
                    onClick={handleSendTestEmail}
                    style={{
                      background: 'linear-gradient(135deg, #ff9800, #ff5722)',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    📧 Send Test Email
                  </button>
                )}
                <button 
                  type="button"
                  className="save-button"
                  onClick={handleSaveNotificationSettings}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

