import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import Register from '../Register';

jest.mock('axios');
jest.mock('../../utils/auth', () => ({
  validateEmail: jest.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  validatePassword: jest.fn((pw) => pw.length >= 6)
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

const renderRegister = () =>
  render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  );

describe('Register Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
  });

  // ─── RENDERING ──────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render the MONIVUE brand name', () => {
      renderRegister();
      expect(screen.getByText('MONIVUE')).toBeInTheDocument();
    });

    it('should render the "Create Account" heading', () => {
      renderRegister();
      expect(screen.getByText('Create Account')).toBeInTheDocument();
    });

    it('should render all required input fields', () => {
      renderRegister();
      expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    });

    it('should render a register submit button', () => {
      renderRegister();
      expect(screen.getByRole('button', { name: /register|sign up|create account/i })).toBeInTheDocument();
    });

    it('should render a link to login page', () => {
      renderRegister();
      expect(screen.getByRole('link', { name: /login|sign in/i })).toBeInTheDocument();
    });
  });

  // ─── VALIDATION ──────────────────────────────────────────────────────────────

  describe('Client-Side Validation', () => {
    it('should show error when passwords do not match', async () => {
      renderRegister();
      await userEvent.type(screen.getByPlaceholderText('Full Name'), 'Test User');
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'test@example.com');

      const passwordInputs = screen.getAllByPlaceholderText(/password/i);
      await userEvent.type(passwordInputs[0], 'Password123!');
      await userEvent.type(passwordInputs[1], 'DifferentPass!');

      fireEvent.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should show error for invalid email', async () => {
      const { validateEmail } = require('../../utils/auth');
      validateEmail.mockReturnValueOnce(false);

      renderRegister();
      await userEvent.type(screen.getByPlaceholderText('Full Name'), 'Test User');
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'invalid-email');

      const passwordInputs = screen.getAllByPlaceholderText(/password/i);
      await userEvent.type(passwordInputs[0], 'Password123!');
      await userEvent.type(passwordInputs[1], 'Password123!');

      fireEvent.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      });
    });
  });

  // ─── FORM SUBMISSION ─────────────────────────────────────────────────────────

  describe('Form Submission', () => {
    const fillForm = async () => {
      await userEvent.type(screen.getByPlaceholderText('Full Name'), 'Test User');
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
      const passwordInputs = screen.getAllByPlaceholderText(/password/i);
      await userEvent.type(passwordInputs[0], 'Password123!');
      await userEvent.type(passwordInputs[1], 'Password123!');
    };

    it('should navigate to /login after successful registration', async () => {
      axios.post.mockResolvedValueOnce({ data: { message: 'User registered' } });
      renderRegister();
      await fillForm();
      fireEvent.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });

    it('should display error message on registration failure', async () => {
      axios.post.mockRejectedValueOnce({
        response: { data: { msg: 'Email already exists' } }
      });
      renderRegister();
      await fillForm();
      fireEvent.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
      });
    });
  });
});
