// API utility functions
import { getAuthToken } from './auth';

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api');

// Generic API call function
const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
};

// Reports functionality removed

// Transaction API functions
export const getTransactions = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  return apiCall(`/transactions${queryParams ? `?${queryParams}` : ''}`);
};

export const createTransaction = async (transactionData) => {
  return apiCall('/transactions', {
    method: 'POST',
    body: JSON.stringify(transactionData),
  });
};

export const updateTransaction = async (id, transactionData) => {
  return apiCall(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(transactionData),
  });
};

export const deleteTransaction = async (id) => {
  return apiCall(`/transactions/${id}`, {
    method: 'DELETE',
  });
};

// Budget API functions
export const getBudgets = async () => {
  return apiCall('/budgets');
};

export const createBudget = async (budgetData) => {
  return apiCall('/budgets', {
    method: 'POST',
    body: JSON.stringify(budgetData),
  });
};

export const updateBudget = async (id, budgetData) => {
  return apiCall(`/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(budgetData),
  });
};

export const deleteBudget = async (id) => {
  return apiCall(`/budgets/${id}`, {
    method: 'DELETE',
  });
};

// Goal API functions
export const getGoals = async () => {
  return apiCall('/goals');
};

export const createGoal = async (goalData) => {
  return apiCall('/goals', {
    method: 'POST',
    body: JSON.stringify(goalData),
  });
};

export const updateGoal = async (id, goalData) => {
  return apiCall(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(goalData),
  });
};

export const deleteGoal = async (id) => {
  return apiCall(`/goals/${id}`, {
    method: 'DELETE',
  });
};

// Category API functions
export const getCategories = async () => {
  return apiCall('/categories');
};

export const createCategory = async (categoryData) => {
  return apiCall('/categories', {
    method: 'POST',
    body: JSON.stringify(categoryData),
  });
};

export const updateCategory = async (id, categoryData) => {
  return apiCall(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(categoryData),
  });
};

export const deleteCategory = async (id) => {
  return apiCall(`/categories/${id}`, {
    method: 'DELETE',
  });
};