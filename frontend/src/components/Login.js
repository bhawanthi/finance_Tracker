import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { setAuthData } from '../utils/auth';
import './styles/Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { usernameOrEmail, password } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('Attempting login with:', formData);

    try {
      const res = await axios.post('/api/auth/login', formData);
      console.log('Login response:', res.data);
      
      if (res.data.token && res.data.user) {
        console.log('Setting auth data...');
        setAuthData(res.data.token, res.data.user);
        
        console.log('Auth data set, checking localStorage...');
        console.log('Token in localStorage:', localStorage.getItem('token') ? 'EXISTS' : 'NOT FOUND');
        console.log('User in localStorage:', localStorage.getItem('user') ? 'EXISTS' : 'NOT FOUND');
        
        console.log('Login successful, navigating to home...');
        
        // Force navigation after a short delay to ensure state updates
        setTimeout(() => {
          navigate('/home', { replace: true });
        }, 100);
      } else {
        console.error('Missing token or user in response:', res.data);
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error:', err.response?.data || err.message);
      setError(err.response?.data?.msg || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="logo-text">MONIVUE</h1>
        <h2 className="auth-title">Welcome Back</h2>
        <form onSubmit={onSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <input
              type="text"
              name="usernameOrEmail"
              value={usernameOrEmail}
              onChange={onChange}
              placeholder="Username or Email"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              value={password}
              onChange={onChange}
              placeholder="Password"
              required
              className="form-input"
            />
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-link">
          Don't have an account? <Link to="/register">Create Account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
