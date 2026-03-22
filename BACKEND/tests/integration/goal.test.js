const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

// ── Mock all Mongoose models ────────────────────────────────────────────────
jest.mock('../../models/User', () => {
  const M = jest.fn();
  M.findOne = jest.fn(); M.findById = jest.fn(); M.find = jest.fn();
  return M;
});
jest.mock('../../models/Budget', () => {
  const M = jest.fn();
  M.find = jest.fn(); M.findOne = jest.fn(); M.aggregate = jest.fn();
  return M;
});
jest.mock('../../models/Transaction', () => {
  const M = jest.fn();
  M.find = jest.fn(); M.findOne = jest.fn(); M.aggregate = jest.fn();
  M.countDocuments = jest.fn(); M.deleteOne = jest.fn();
  return M;
});
jest.mock('../../models/Goal', () => {
  const M = jest.fn();
  M.find = jest.fn(); M.findOne = jest.fn(); M.deleteOne = jest.fn();
  return M;
});
jest.mock('../../models/Category', () => {
  const M = jest.fn();
  M.find = jest.fn();
  return M;
});

const Goal = require('../../models/Goal');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const app = require('../testApp');

// Helper: create a Mongoose-style chainable query mock
const chainable = (result) => {
  const chain = {
    sort: jest.fn().mockReturnValue(null),
    limit: jest.fn().mockReturnValue(null),
    skip: jest.fn().mockReturnValue(null),
    exec: jest.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  return chain;
};

describe('Goal Routes - Integration Tests', () => {
  const userId = '507f1f77bcf86cd799439011';
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

  const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const validGoal = {
    name: 'Emergency Fund',
    targetAmount: 5000,
    targetDate: futureDate,
    category: 'emergency',
    priority: 'high'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Transaction.find chain for generateGoalAnalysis
    Transaction.find.mockReturnValue(chainable([]));
    // Mock User.findById for generateGoalAnalysis
    User.findById.mockResolvedValue({ _id: userId, monthlySalary: 5000 });
  });

  // ─── GET GOALS ────────────────────────────────────────────────────────────

  describe('GET /api/goals', () => {
    it('should return goals for authenticated user', async () => {
      Goal.find.mockReturnValue(chainable([]));

      const res = await request(app)
        .get('/api/goals')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/goals');
      expect(res.status).toBe(401);
    });
  });

  // ─── CREATE GOAL ──────────────────────────────────────────────────────────

  describe('POST /api/goals', () => {
    beforeEach(() => {
      Goal.mockImplementation((data) => {
        const inst = {
          ...data,
          _id: 'mock-goal-id',
          currentAmount: 0,
          contributions: [],
          progressPercentage: 0,
          save: jest.fn(),
          toObject: jest.fn()
        };
        const plain = { ...inst };
        delete plain.save;
        delete plain.toObject;
        inst.toObject.mockReturnValue(plain);
        inst.save.mockResolvedValue(inst);
        return inst;
      });
    });

    it('should create a goal successfully with milestones', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send(validGoal);

      expect(res.status).toBe(201);
      expect(res.body.goal).toMatchObject({
        name: validGoal.name,
        targetAmount: validGoal.targetAmount
      });
      expect(res.body.goal.milestones).toHaveLength(4);
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Vacation' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if targetAmount is negative', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validGoal, targetAmount: -100 });

      expect(res.status).toBe(400);
    });

    it('should return 400 if targetDate is in the past', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validGoal, targetDate: pastDate });

      expect(res.status).toBe(400);
    });
  });

  // ─── UPDATE GOAL ──────────────────────────────────────────────────────────

  describe('PUT /api/goals/:id', () => {
    it('should update goal name and priority', async () => {
      const mockGoal = {
        _id: 'mock-goal-id',
        userId,
        name: 'Emergency Fund',
        targetAmount: 5000,
        currentAmount: 0,
        status: 'active',
        milestones: [
          { percentage: 25, amount: 1250, achieved: false },
          { percentage: 50, amount: 2500, achieved: false },
          { percentage: 75, amount: 3750, achieved: false },
          { percentage: 100, amount: 5000, achieved: false }
        ],
        progressPercentage: 0,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn()
      };
      mockGoal.toObject.mockReturnValue({ ...mockGoal });
      Goal.findOne.mockResolvedValue(mockGoal);

      const res = await request(app)
        .put('/api/goals/mock-goal-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Fund', priority: 'medium' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    it('should return 404 for non-existent goal', async () => {
      Goal.findOne.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/goals/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE GOAL ──────────────────────────────────────────────────────────

  describe('DELETE /api/goals/:id', () => {
    it('should delete a goal successfully', async () => {
      Goal.findOne.mockResolvedValue({ _id: 'mock-goal-id', userId });
      Goal.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete('/api/goals/mock-goal-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it('should return 404 for non-existent goal', async () => {
      Goal.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/goals/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
