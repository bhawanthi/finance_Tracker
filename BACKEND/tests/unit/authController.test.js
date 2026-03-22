const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authController = require('../../controllers/authController');
const User = require('../../models/User');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Auth Controller - Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  // ─── REGISTER ────────────────────────────────────────────────────────────────

  describe('register()', () => {
    const validBody = {
      name: 'John Doe',
      email: 'john@example.com',
      age: '25',
      jobRole: 'Engineer',
      monthlySalary: '5000',
      currency: 'USD',
      password: 'password123',
      confirmPassword: 'password123'
    };

    it('should return 400 if required fields are missing', async () => {
      req.body = { name: 'John' };
      await authController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ msg: 'All fields are required' });
    });

    it('should return 400 if passwords do not match', async () => {
      req.body = { ...validBody, confirmPassword: 'wrongpassword' };
      await authController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ msg: 'Passwords do not match' });
    });

    it('should return 400 if email already exists', async () => {
      req.body = validBody;
      User.findOne.mockResolvedValue({ email: 'john@example.com' });
      await authController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ msg: 'Email already exists' });
    });

    it('should register successfully with valid data', async () => {
      req.body = validBody;
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedpassword');
      const mockSave = jest.fn().mockResolvedValue({});
      User.mockImplementation(() => ({ save: mockSave }));

      await authController.register(req, res);
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ msg: 'User registered successfully' });
    });

    it('should return 500 on server error', async () => {
      req.body = validBody;
      User.findOne.mockRejectedValue(new Error('DB error'));
      await authController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── LOGIN ────────────────────────────────────────────────────────────────────

  describe('login()', () => {
    const validLogin = { usernameOrEmail: 'john@example.com', password: 'password123' };

    it('should return 400 if fields are missing', async () => {
      req.body = { usernameOrEmail: '' };
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ msg: 'All fields are required' });
    });

    it('should return 400 if user not found', async () => {
      req.body = validLogin;
      User.findOne.mockResolvedValue(null);
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ msg: 'Invalid credentials' });
    });

    it('should return 400 if password does not match', async () => {
      req.body = validLogin;
      User.findOne.mockResolvedValue({ password: 'hashedpassword' });
      bcrypt.compare.mockResolvedValue(false);
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ msg: 'Invalid credentials' });
    });

    it('should return token and user on successful login', async () => {
      req.body = validLogin;
      const mockUser = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
        jobRole: 'Engineer',
        monthlySalary: 5000,
        currency: 'USD',
        password: 'hashedpassword'
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock_jwt_token');

      await authController.login(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mock_jwt_token',
          user: expect.objectContaining({ email: 'john@example.com' })
        })
      );
    });

    it('should return 500 on server error', async () => {
      req.body = validLogin;
      User.findOne.mockRejectedValue(new Error('DB error'));
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
