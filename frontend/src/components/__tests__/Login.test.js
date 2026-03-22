import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import Login from '../Login';

jest.mock('axios');
jest.mock('../../utils/auth', () => ({
  setAuthData: jest.fn()
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

const renderLogin = () =>
  render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── RENDERING ──────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render the MONIVUE brand name', () => {
      renderLogin();
      expect(screen.getByText('MONIVUE')).toBeInTheDocument();
    });

    it('should render the "Welcome Back" heading', () => {
      renderLogin();
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    });

    it('should render username/email and password inputs', () => {
      renderLogin();
      expect(screen.getByPlaceholderText('Username or Email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    });

    it('should render a login submit button', () => {
      renderLogin();
      expect(screen.getByRole('button', { name: /login|sign in/i })).toBeInTheDocument();
    });

    it('should render a link to register page', () => {
      renderLogin();
      expect(screen.getByRole('link', { name: /sign up|register|create account/i })).toBeInTheDocument();
    });
  });

  // ─── FORM INTERACTION ────────────────────────────────────────────────────────

  describe('Form Interaction', () => {
    it('should update email input on change', async () => {
      renderLogin();
      const emailInput = screen.getByPlaceholderText('Username or Email');
      await userEvent.type(emailInput, 'test@example.com');
      expect(emailInput.value).toBe('test@example.com');
    });

    it('should update password input on change', async () => {
      renderLogin();
      const passwordInput = screen.getByPlaceholderText('Password');
      await userEvent.type(passwordInput, 'mypassword');
      expect(passwordInput.value).toBe('mypassword');
    });
  });

  // ─── FORM SUBMISSION ─────────────────────────────────────────────────────────

  describe('Form Submission', () => {
    it('should call axios.post with credentials on submit', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          token: 'mock-token',
          user: { id: '1', email: 'test@example.com', name: 'Test' }
        }
      });

      renderLogin();
      await userEvent.type(screen.getByPlaceholderText('Username or Email'), 'test@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'Password123!');
      fireEvent.click(screen.getByRole('button', { name: /login|sign in/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/login'),
          expect.objectContaining({ usernameOrEmail: 'test@example.com' })
        );
      });
    });

    it('should display error message on failed login', async () => {
      axios.post.mockRejectedValueOnce({
        response: { data: { msg: 'Invalid credentials' } }
      });

      renderLogin();
      await userEvent.type(screen.getByPlaceholderText('Username or Email'), 'wrong@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'wrongpass');
      fireEvent.click(screen.getByRole('button', { name: /login|sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('should navigate to /home after successful login', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          token: 'mock-token',
          user: { id: '1', email: 'test@example.com', name: 'Test' }
        }
      });

      renderLogin();
      await userEvent.type(screen.getByPlaceholderText('Username or Email'), 'test@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'Password123!');
      fireEvent.click(screen.getByRole('button', { name: /login|sign in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
      }, { timeout: 500 });
    });
  });
});
