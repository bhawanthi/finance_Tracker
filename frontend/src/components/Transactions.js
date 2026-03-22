import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserData, clearAuthData, formatCurrency } from '../utils/auth';
import TransactionModal from './TransactionModal';
import './styles/Goals.css';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    category: 'all',
    startDate: '',
    endDate: ''
  });
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    monthlySalary: '',
    currency: 'USD'
  });
  const navigate = useNavigate();

  const fetchTransactions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      
      if (filters.type !== 'all') queryParams.append('type', filters.type);
      if (filters.category !== 'all') queryParams.append('category', filters.category);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const response = await fetch(`/api/transactions?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/stats?period=monthly', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
    fetchCategories();
  }, [fetchTransactions, fetchStats, fetchCategories]);

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

  const handleDeleteTransaction = async (transactionId) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/transactions/${transactionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          fetchTransactions();
          fetchStats();
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getIncomeTotal = () => {
    return stats?.totals?.find(t => t._id === 'income')?.total || 0;
  };

  const getExpenseTotal = () => {
    return stats?.totals?.find(t => t._id === 'expense')?.total || 0;
  };

  const getBalance = () => {
    return getIncomeTotal() - getExpenseTotal();
  };

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
              className="nav-link active"
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
            <span className="title-icon">💰</span>
            Transactions
          </h1>
          <div className="header-actions">
            <button 
              className="btn btn-primary"
              onClick={() => setShowIncomeModal(true)}
            >
              <span className="btn-icon">💵</span>
              Add Income
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => setShowExpenseModal(true)}
            >
              <span className="btn-icon">🛒</span>
              Add Expense
            </button>
          </div>
        </div>

        {/* Transaction Overview */}
        <div className="goals-overview">
          <div className="overview-card">
            <div className="overview-icon">📈</div>
            <div className="overview-content">
              <div className="overview-label">Total Income</div>
              <div className="overview-value">{formatCurrency(getIncomeTotal())}</div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon">📊</div>
            <div className="overview-content">
              <div className="overview-label">Total Expenses</div>
              <div className="overview-value">{formatCurrency(getExpenseTotal())}</div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon">{getBalance() >= 0 ? '💰' : '⚠️'}</div>
            <div className="overview-content">
              <div className="overview-label">Net Balance</div>
              <div className="overview-value">{formatCurrency(getBalance())}</div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon">📝</div>
            <div className="overview-content">
              <div className="overview-label">Total Transactions</div>
              <div className="overview-value">{transactions.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="transactions-filters">
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">
              <span>🏷️</span>
              Type
            </label>
            <select 
              value={filters.type}
              onChange={(e) => setFilters(prev => ({...prev, type: e.target.value}))}
              className="filter-select"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <span>📂</span>
              Category
            </label>
            <select 
              value={filters.category}
              onChange={(e) => setFilters(prev => ({...prev, category: e.target.value}))}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <span>📅</span>
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({...prev, startDate: e.target.value}))}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <span>📅</span>
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({...prev, endDate: e.target.value}))}
              className="filter-input"
            />
          </div>
        </div>

        <div className="filter-actions">
          <button 
            className="clear-filters-btn"
            onClick={() => setFilters({type: 'all', category: 'all', startDate: '', endDate: ''})}
          >
            <span>🔄</span>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Transactions Grid */}
      <div className="goals-grid">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No Transactions Found</h3>
            <p>Start by adding your first income or expense transaction.</p>
          </div>
        ) : (
          transactions.map(transaction => {
            const category = categories.find(cat => cat.name === transaction.category);
            return (
              <div key={transaction._id} className={`transaction-card ${transaction.type}`}>
                <div className="transaction-header">
                  <h3 className="transaction-name">{transaction.description}</h3>
                  <div className={`transaction-amount ${transaction.type}`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </div>
                </div>

                <div className="transaction-details">
                  <div className="transaction-detail">
                    <span className="transaction-detail-label">Category</span>
                    <span className="transaction-detail-value">
                      {category?.icon || (transaction.type === 'income' ? '💰' : '💸')} {transaction.category}
                    </span>
                  </div>
                  <div className="transaction-detail">
                    <span className="transaction-detail-label">Date</span>
                    <span className="transaction-detail-value">{formatDate(transaction.date)}</span>
                  </div>
                  {transaction.paymentMethod && (
                    <div className="transaction-detail">
                      <span className="transaction-detail-label">Payment</span>
                      <span className="transaction-detail-value">{transaction.paymentMethod.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>

                <div className="transaction-actions">
                  <button 
                    className="transaction-delete-btn"
                    onClick={() => handleDeleteTransaction(transaction._id)}
                    title="Delete transaction"
                  >
                    🗑️ Delete
                  </button>
                </div>

                {transaction.subcategory && (
                  <div className="transaction-detail" style={{marginTop: '12px'}}>
                    <span className="transaction-detail-label">Subcategory</span>
                    <span className="transaction-detail-value">{transaction.subcategory}</span>
                  </div>
                )}

                {transaction.tags && transaction.tags.length > 0 && (
                  <div className="transaction-tags">
                    {transaction.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <TransactionModal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        type="income"
        onSuccess={() => {
          fetchTransactions();
          fetchStats();
        }}
      />

      <TransactionModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        type="expense"
        onSuccess={() => {
          fetchTransactions();
          fetchStats();
        }}
      />

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

export default Transactions;