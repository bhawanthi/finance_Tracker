import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserData, clearAuthData, formatCurrency } from '../utils/auth';
import './styles/Goals.css';

const Goals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    description: ''
  });
  const [contributionAmount, setContributionAmount] = useState('');
  const [goalAnalysis, setGoalAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    monthlySalary: '',
    currency: 'USD'
  });
  const navigate = useNavigate();
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const achievedGoals = goals.filter((goal) => goal.status === 'completed' || getGoalProgressWidth(goal) >= 100);

  const fetchGoals = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/goals?status=all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGoals(data);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    const userData = getUserData();
    if (userData) {
      setUser(userData);
      setEditFormData({
        name: userData.name || '',
        email: userData.email || '',
        monthlySalary: userData.monthlySalary || '',
        currency: userData.currency || 'USD'
      });
    }

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

  const handleCloseEditProfile = () => {
    setShowEditProfile(false);
  };

  const handleEditProfile = () => {
    setShowProfileDropdown(false);
    setShowEditProfile(true);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editFormData)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser.user);
        localStorage.setItem('user', JSON.stringify(updatedUser.user));
        setShowEditProfile(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          targetAmount: parseFloat(formData.targetAmount),
          targetDate: formData.targetDate,
          description: formData.description
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Goal created:', result);
        
        // Store the analysis and show modal
        if (result.analysis) {
          setGoalAnalysis(result.analysis);
          setShowAnalysisModal(true);
        }
        
        setShowCreateModal(false);
        setFormData({
          name: '',
          targetAmount: '',
          targetDate: '',
          description: ''
        });
        fetchGoals();
      } else {
        const errorData = await response.json();
        console.error('Error creating goal:', errorData);
        alert(errorData.message || 'Failed to create goal');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Failed to create goal. Please try again.');
    }
  };

  const handleContribute = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/goals/${selectedGoal._id}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(contributionAmount)
        })
      });

      if (response.ok) {
        setShowContributeModal(false);
        setContributionAmount('');
        setSelectedGoal(null);
        fetchGoals();
      }
    } catch (error) {
      console.error('Error adding contribution:', error);
    }
  };

  const handleDelete = async (goalId) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/goals/${goalId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          fetchGoals();
        }
      } catch (error) {
        console.error('Error deleting goal:', error);
      }
    }
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '',
      description: goal.description || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/goals/${editingGoal._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          targetAmount: parseFloat(formData.targetAmount),
          targetDate: formData.targetDate,
          description: formData.description
        })
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingGoal(null);
        setFormData({
          name: '',
          targetAmount: '',
          targetDate: '',
          description: ''
        });
        fetchGoals();
      } else {
        const errorData = await response.json();
        console.error('Error updating goal:', errorData);
        alert(errorData.message || 'Failed to update goal');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Failed to update goal. Please try again.');
    }
  };

  const requestGoalAnalysis = async (goal) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/goals/${goal._id}/analysis`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGoalAnalysis(data.analysis);
        setShowAnalysisModal(true);
      } else {
        console.error('Failed to get goal analysis');
        alert('Failed to generate goal analysis. Please try again.');
      }
    } catch (error) {
      console.error('Error requesting goal analysis:', error);
      alert('Failed to generate goal analysis. Please try again.');
    }
  };

  function getGoalProgressWidth(goal) {
    if (!goal.currentAmount || goal.targetAmount === 0) return 0;
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  }

  const getGoalStatus = (goal) => {
    const percentage = getGoalProgressWidth(goal);
    const deadline = new Date(goal.deadline);
    const today = new Date();
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    
    if (percentage >= 100) return 'achieved';
    if (daysLeft < 0) return 'overdue';
    if (daysLeft <= 30) return 'urgent';
    return 'on-track';
  };

  const getDaysRemaining = (targetDate) => {
    const today = new Date();
    const deadlineDate = new Date(targetDate);
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const openContributeModal = (goal) => {
    setSelectedGoal(goal);
    setShowContributeModal(true);
  };

  if (loading) {
    return (
      <div className="loading-dashboard">
        <div className="loading-spinner"></div>
        <p>Loading your goals...</p>
      </div>
    );
  }

  return (
    <div className="goals-container">
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
              className="nav-link active"
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
              <span className="user-greeting">{getTimeOfDayGreeting()}, {user.name}!</span>
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
            <button onClick={toggleProfileDropdown} className="profile-button">
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
                <button onClick={handleEditProfile} className="dropdown-item">
                  <span className="dropdown-icon">⚙️</span>
                  <span>Edit Profile</span>
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

      {/* Header */}
      <div className="goals-header">
        <div className="header-content">
          <h1 className="page-title">
            <span className="title-icon">🎯</span>
            Savings Goals
          </h1>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="btn-icon">➕</span>
            Set New Goal
          </button>
        </div>

        {/* Goals Overview */}
        <div className="goals-overview">
          <div className="overview-card">
            <div className="overview-icon">📈</div>
            <div className="overview-content">
              <div className="overview-label">Active Goals</div>
              <div className="overview-value">{activeGoals.length}</div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon">🎯</div>
            <div className="overview-content">
              <div className="overview-label">Target Amount</div>
              <div className="overview-value">
                {formatCurrency(goals.reduce((sum, goal) => sum + goal.targetAmount, 0))}
              </div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon">💰</div>
            <div className="overview-content">
              <div className="overview-label">Total Saved</div>
              <div className="overview-value">
                {formatCurrency(goals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0))}
              </div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon">✅</div>
            <div className="overview-content">
              <div className="overview-label">Achieved</div>
              <div className="overview-value">
                {achievedGoals.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="goals-grid">
        {activeGoals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>No Goals Set Yet</h3>
            <p>Create your first savings goal to start tracking your progress</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Set Your First Goal
            </button>
          </div>
        ) : (
          activeGoals.map(goal => (
            <div key={goal._id} className={`goal-card ${getGoalStatus(goal)}`}>
              <div className="goal-header-card">
                <h3 className="goal-name">{goal.name}</h3>
                <div className="goal-actions">
                  <button 
                    className="action-btn contribute"
                    onClick={() => openContributeModal(goal)}
                    title="Add Contribution"
                  >
                    💰
                  </button>
                  <button 
                    className="action-btn analysis"
                    onClick={() => requestGoalAnalysis(goal)}
                    title="Get AI Financial Analysis & Success Plan"
                  >
                    🧠
                  </button>
                  <button 
                    className="action-btn edit"
                    onClick={() => handleEdit(goal)}
                    title="Edit Goal"
                  >
                    ✏️
                  </button>
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(goal._id)}
                    title="Delete Goal"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="goal-amount">
                <span className="current">{formatCurrency(goal.currentAmount || 0)}</span>
                <span className="separator"> / </span>
                <span className="target">{formatCurrency(goal.targetAmount)}</span>
              </div>

              <div className="goal-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getGoalProgressWidth(goal)}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {getGoalProgressWidth(goal).toFixed(0)}% achieved
                </div>
              </div>

              <div className="goal-info">
                <div className="deadline-info">
                  <span className="deadline-label">Deadline:</span>
                  <span className={`deadline-value ${getDaysRemaining(goal.targetDate) < 0 ? 'overdue' : getDaysRemaining(goal.targetDate) <= 30 ? 'urgent' : ''}`}>
                    {new Date(goal.targetDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="days-remaining">
                  {getDaysRemaining(goal.targetDate) >= 0 ? (
                    <span className={`days-left ${getDaysRemaining(goal.targetDate) <= 30 ? 'urgent' : ''}`}>
                      {getDaysRemaining(goal.targetDate)} days left
                    </span>
                  ) : (
                    <span className="days-left overdue">
                      {Math.abs(getDaysRemaining(goal.targetDate))} days overdue
                    </span>
                  )}
                </div>
              </div>

              <div className="goal-remaining">
                <span className="remaining-amount">
                  {goal.currentAmount >= goal.targetAmount ? 'Goal Achieved! 🎉' : 
                   `${formatCurrency(goal.targetAmount - (goal.currentAmount || 0))} remaining`}
                </span>
              </div>

              {goal.description && (
                <div className="goal-description">
                  {goal.description}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Goal Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Set New Goal</h2>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="goal-form">
              <div className="form-group">
                <label>Goal Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Vacation Fund, Emergency Fund"
                  required
                />
              </div>

              <div className="form-group">
                <label>Target Amount</label>
                <input
                  type="number"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({...formData, targetAmount: e.target.value})}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Target Date</label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({...formData, targetDate: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Brief description of this goal..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContributeModal && selectedGoal && (
        <div className="modal-overlay" onClick={() => setShowContributeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add to {selectedGoal.name}</h2>
              <button 
                className="close-btn"
                onClick={() => setShowContributeModal(false)}
              >
                ×
              </button>
            </div>

            <div className="contribute-info">
              <div className="current-progress">
                <p>Current Progress: <strong>{formatCurrency(selectedGoal.currentAmount || 0)}</strong> / {formatCurrency(selectedGoal.targetAmount)}</p>
                <div className="mini-progress-bar">
                  <div 
                    className="mini-progress-fill"
                    style={{ width: `${getGoalProgressWidth(selectedGoal)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <form onSubmit={handleContribute} className="contribute-form">
              <div className="form-group">
                <label>Contribution Amount</label>
                <input
                  type="number"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowContributeModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {showEditModal && editingGoal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Goal</h2>
              <button 
                className="close-btn"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdate} className="goal-form">
              <div className="form-group">
                <label>Goal Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Buy a car, Vacation fund..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Target Amount</label>
                <input
                  type="number"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({...formData, targetAmount: e.target.value})}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Target Date</label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({...formData, targetDate: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Brief description of this goal..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goal Analysis Modal */}
      {showAnalysisModal && goalAnalysis && (
        <div className="modal-overlay" onClick={() => setShowAnalysisModal(false)}>
          <div className="modal-content analysis-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎯 Goal Analysis & Financial Plan</h2>
              <button 
                className="close-btn"
                onClick={() => setShowAnalysisModal(false)}
              >
                ×
              </button>
            </div>

            <div className="analysis-content">
              {/* Goal Summary */}
              <div className="analysis-section">
                <h3>📊 Goal Overview</h3>
                <div className="goal-summary-grid">
                  <div className="summary-item">
                    <span className="label">Goal:</span>
                    <span className="value">{goalAnalysis.goalSummary.name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Target Amount:</span>
                    <span className="value">{formatCurrency(goalAnalysis.goalSummary.targetAmount)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Timeline:</span>
                    <span className="value">{goalAnalysis.goalSummary.monthsToGoal} months</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Required Monthly Saving:</span>
                    <span className="value highlight">{formatCurrency(goalAnalysis.goalSummary.requiredMonthlySaving)}</span>
                  </div>
                </div>
              </div>

              {/* Feasibility Analysis */}
              <div className="analysis-section">
                <h3>🎭 Feasibility Analysis</h3>
                <div className="feasibility-card">
                  <div className="feasibility-score">
                    <div className={`score-circle ${goalAnalysis.feasibilityAnalysis.status}`}>
                      <span className="score">{goalAnalysis.feasibilityAnalysis.feasibilityScore}%</span>
                    </div>
                    <div className="score-info">
                      <h4 className={`status ${goalAnalysis.feasibilityAnalysis.status}`}>
                        {goalAnalysis.feasibilityAnalysis.status.toUpperCase()}
                      </h4>
                      <p className="difficulty">Difficulty: {goalAnalysis.feasibilityAnalysis.difficulty}</p>
                    </div>
                  </div>
                  <p className="feasibility-message">{goalAnalysis.feasibilityAnalysis.message}</p>
                  {goalAnalysis.feasibilityAnalysis.shortfall > 0 && (
                    <div className="shortfall-alert">
                      <strong>⚠️ Monthly Shortfall: {formatCurrency(goalAnalysis.feasibilityAnalysis.shortfall)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="analysis-section">
                <h3>💰 Current Financial Snapshot</h3>
                <div className="financial-grid">
                  <div className="financial-item income">
                    <div className="icon">📈</div>
                    <div className="details">
                      <span className="label">Monthly Income</span>
                      <span className="amount">{formatCurrency(goalAnalysis.financialSnapshot.monthlyIncome)}</span>
                    </div>
                  </div>
                  <div className="financial-item expense">
                    <div className="icon">📉</div>
                    <div className="details">
                      <span className="label">Monthly Expenses</span>
                      <span className="amount">{formatCurrency(goalAnalysis.financialSnapshot.monthlyExpenses)}</span>
                    </div>
                  </div>
                  <div className="financial-item savings">
                    <div className="icon">💎</div>
                    <div className="details">
                      <span className="label">Savings Capacity</span>
                      <span className="amount">{formatCurrency(goalAnalysis.financialSnapshot.currentSavingsCapacity)}</span>
                    </div>
                  </div>
                  <div className="financial-item rate">
                    <div className="icon">📊</div>
                    <div className="details">
                      <span className="label">Savings Rate</span>
                      <span className="amount">{goalAnalysis.financialSnapshot.savingsRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Savings Strategy */}
              <div className="analysis-section">
                <h3>🚀 Recommended Strategies</h3>
                <div className="strategies-list">
                  {goalAnalysis.savingsStrategy.map((strategy, index) => (
                    <div key={index} className="strategy-card">
                      <div className="strategy-header">
                        <h4>{strategy.title}</h4>
                        <div className="strategy-badges">
                          <span className={`badge impact-${strategy.impact}`}>
                            {strategy.impact} impact
                          </span>
                          <span className={`badge effort-${strategy.effort}`}>
                            {strategy.effort} effort
                          </span>
                        </div>
                      </div>
                      <p>{strategy.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Budget Recommendations */}
              {goalAnalysis.budgetRecommendations.length > 0 && (
                <div className="analysis-section">
                  <h3>✂️ Budget Optimization</h3>
                  <div className="budget-recommendations">
                    {goalAnalysis.budgetRecommendations.map((rec, index) => (
                      <div key={index} className="budget-card">
                        <div className="budget-header">
                          <h4>{rec.category}</h4>
                          <span className={`priority-${rec.priority}`}>
                            {rec.priority} priority
                          </span>
                        </div>
                        <div className="budget-numbers">
                          <div className="current">
                            <span className="label">Current:</span>
                            <span className="amount">{formatCurrency(rec.currentSpending)}/mo</span>
                          </div>
                          <div className="arrow">→</div>
                          <div className="target">
                            <span className="label">Target:</span>
                            <span className="amount">{formatCurrency(rec.newBudget)}/mo</span>
                          </div>
                          <div className="savings">
                            <span className="label">Save:</span>
                            <span className="amount green">{formatCurrency(rec.suggestedReduction)}/mo</span>
                          </div>
                        </div>
                        <p className="suggestion">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Milestones */}
              <div className="analysis-section">
                <h3>🏆 Milestone Plan</h3>
                <div className="milestones-timeline">
                  {goalAnalysis.milestonesPlan.map((milestone, index) => (
                    <div key={index} className="milestone-item">
                      <div className="milestone-marker">{milestone.percentage}%</div>
                      <div className="milestone-details">
                        <h4>{milestone.description}</h4>
                        <p className="milestone-amount">{formatCurrency(milestone.amount)}</p>
                        <p className="milestone-date">
                          Target: {new Date(milestone.targetDate).toLocaleDateString()}
                        </p>
                        <p className="celebration">🎉 {milestone.celebration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="analysis-section">
                <h3>⚠️ Risk Assessment</h3>
                <div className="risk-assessment">
                  <div className="success-probability">
                    <div className="probability-bar">
                      <div 
                        className="probability-fill"
                        style={{ width: `${goalAnalysis.riskAssessment.successProbability}%` }}
                      ></div>
                    </div>
                    <p>Success Probability: <strong>{Math.round(goalAnalysis.riskAssessment.successProbability)}%</strong></p>
                  </div>
                  <div className="risks-list">
                    {goalAnalysis.riskAssessment.risks.map((risk, index) => (
                      <div key={index} className={`risk-card ${risk.level}`}>
                        <h4>{risk.type.replace('_', ' ').toUpperCase()}</h4>
                        <p className="risk-description">{risk.description}</p>
                        <p className="mitigation"><strong>Mitigation:</strong> {risk.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-primary"
                onClick={() => setShowAnalysisModal(false)}
              >
                Got it! Let's Start Saving 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseEditProfile()}>
          <div className="edit-profile-modal">
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
    </div>
  );
};

export default Goals;