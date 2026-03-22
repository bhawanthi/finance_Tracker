const request = require('supertest');
const bcrypt = require('bcryptjs');

// Ensure JWT_SECRET is set before any imports
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

// ── Mock all Mongoose models to avoid real DB connections ────────────────────
jest.mock('../../models/User', () => {
  const M = jest.fn();
  M.findOne = jest.fn();
  M.findById = jest.fn();
  M.find = jest.fn();
  return M;
});
jest.mock('../../models/Budget', () => {
  const M = jest.fn();
  M.find = jest.fn(); M.findOne = jest.fn(); M.aggregate = jest.fn();
  return M;
});
jest.mock('../../models/Transaction', () => {
  const M = jest.fn();
  M.find = jest.fn(); M.findOne = jest.fn(); M.aggregate = jest.fn(); M.countDocuments = jest.fn();
  return M;
});
jest.mock('../../models/Goal', () => {
  const M = jest.fn();
  M.find = jest.fn(); M.findOne = jest.fn();
  return M;
});
jest.mock('../../models/Category', () => {
  const M = jest.fn();
  M.find = jest.fn();
  return M;
});

const User = require('../../models/User');
const app = require('../testApp');

describe('Auth Routes - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default constructor: returns object with save()
    User.mockImplementation((data) => ({
      ...data,
      _id: 'mock-user-id',
      save: jest.fn().mockResolvedValue(true)
    }));
  });

  const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    age: 25,
    jobRole: 'Developer',
    monthlySalary: 5000,
    currency: 'USD',
    password: 'Password123!',
    confirmPassword: 'Password123!'
  };

  // ─── REGISTER ────────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('msg', 'User registered successfully');
    });

    it('should return 400 if passwords do not match', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUser, confirmPassword: 'WrongPass123!' });

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/password/i);
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'partial@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/required/i);
    });

    it('should return 400 if email already exists', async () => {
      User.findOne.mockResolvedValue({ email: validUser.email });

      const res = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/already/i);
    });
  });

  // ─── LOGIN ───────────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    const hashedPassword = bcrypt.hashSync('Password123!', 10);
    const mockUser = {
      _id: 'mock-user-id',
      name: 'Test User',
      email: 'test@example.com',
      age: 25,
      jobRole: 'Developer',
      monthlySalary: 5000,
      currency: 'USD',
      password: hashedPassword
    };

    it('should login with valid credentials and return a token', async () => {
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toMatchObject({ email: 'test@example.com', name: 'Test User' });
    });

    it('should return 400 with wrong password', async () => {
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'test@example.com', password: 'WrongPassword!' });

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/invalid credentials/i);
    });

    it('should return 400 if user does not exist', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'nobody@example.com', password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/invalid credentials/i);
    });

    it('should return 400 if fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/required/i);
    });
  });
});
