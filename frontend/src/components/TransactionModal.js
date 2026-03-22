import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './styles/TransactionModal.css';

Modal.setAppElement('#root');

const TransactionModal = ({ isOpen, onClose, type, onSuccess }) => {
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    subcategory: '',
    description: '',
    date: new Date(),
    paymentMethod: 'cash',
    tags: [],
    recurring: {
      isRecurring: false,
      frequency: 'monthly'
    }
  });
  
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Payment methods
  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: '💵' },
    { value: 'credit_card', label: 'Credit Card', icon: '💳' },
    { value: 'debit_card', label: 'Debit Card', icon: '💳' },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
    { value: 'digital_wallet', label: 'Digital Wallet', icon: '📱' },
    { value: 'other', label: 'Other', icon: '❓' }
  ];

  // Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`/api/categories?type=${type}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load categories');
        }

        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          return;
        }

        // If categories are empty (first run), seed defaults and refetch once.
        const seedResponse = await fetch('/api/categories/seed', { method: 'POST' });
        if (!seedResponse.ok) {
          throw new Error('Failed to initialize categories');
        }

        const refetchResponse = await fetch(`/api/categories?type=${type}`);
        const refetchData = await refetchResponse.json();

        if (!refetchResponse.ok) {
          throw new Error(refetchData.message || 'Failed to load categories after seeding');
        }

        setCategories(Array.isArray(refetchData) ? refetchData : []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories([]);
      }
    };

    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, type]);

  // Update subcategories when category changes
  useEffect(() => {
    const selectedCategory = categories.find(cat => cat.name === formData.category);
    setSubcategories(selectedCategory?.subcategories || []);
    setFormData(prev => ({ ...prev, subcategory: '' }));
  }, [formData.category, categories]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        amount: '',
        category: '',
        subcategory: '',
        description: '',
        date: new Date(),
        paymentMethod: 'cash',
        tags: [],
        recurring: {
          isRecurring: false,
          frequency: 'monthly'
        }
      });
      setError('');
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: inputType === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: inputType === 'checkbox' ? checked : value
      }));
    }
  };

  const handleTagInput = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      const newTag = e.target.value.trim();
      if (!formData.tags.includes(newTag)) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, newTag]
        }));
      }
      e.target.value = '';
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          type,
          amount: parseFloat(formData.amount)
        })
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess && onSuccess(data.transaction);
        onClose();
      } else {
        setError(data.message || 'Failed to add transaction');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="transaction-modal"
      overlayClassName="transaction-modal-overlay"
    >
      <div className="modal-header">
        <h2 className="modal-title">
          <span className="modal-icon">
            {type === 'income' ? '💰' : '🛒'}
          </span>
          Add {type === 'income' ? 'Income' : 'Expense'}
        </h2>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="transaction-form">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Amount */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount *</label>
            <div className="amount-input">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                className="form-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>
        </div>

        {/* Category and Subcategory */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Category *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="form-select"
              required
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {subcategories.length > 0 && (
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <select
                name="subcategory"
                value={formData.subcategory}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="">Select Subcategory</option>
                {subcategories.map(sub => (
                  <option key={sub.name} value={sub.name}>
                    {sub.icon} {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Description *</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter description"
              required
            />
          </div>
        </div>

        {/* Date and Payment Method */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date</label>
            <DatePicker
              selected={formData.date}
              onChange={(date) => setFormData(prev => ({ ...prev, date }))}
              className="form-input date-picker"
              dateFormat="MMM d, yyyy"
              maxDate={new Date()}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleInputChange}
              className="form-select"
            >
              {paymentMethods.map(method => (
                <option key={method.value} value={method.value}>
                  {method.icon} {method.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tags</label>
            <input
              type="text"
              className="form-input"
              placeholder="Press Enter to add tags"
              onKeyDown={handleTagInput}
            />
            {formData.tags.length > 0 && (
              <div className="tags-container">
                {formData.tags.map(tag => (
                  <span key={tag} className="tag">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="tag-remove">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recurring Transaction */}
        <div className="form-row">
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="recurring.isRecurring"
                checked={formData.recurring.isRecurring}
                onChange={handleInputChange}
                className="checkbox"
              />
              <span className="checkmark"></span>
              Recurring Transaction
            </label>
            
            {formData.recurring.isRecurring && (
              <select
                name="recurring.frequency"
                value={formData.recurring.frequency}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="form-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`btn btn-primary ${type === 'income' ? 'btn-income' : 'btn-expense'}`}
            disabled={loading}
          >
            {loading ? 'Adding...' : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TransactionModal;