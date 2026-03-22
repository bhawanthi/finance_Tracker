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
  M.find = jest.fn(); M.findOne = jest.fn(); M.deleteOne = jest.fn(); M.aggregate = jest.fn();
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
  M.find = jest.fn(); M.findOne = jest.fn();
  return M;
});
jest.mock('../../models/Category', () => {
  const M = jest.fn();
  M.find = jest.fn();
  return M;
});

const Budget = require('../../models/Budget');
const Transaction = require('../../models/Transaction');
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

describe('Budget Routes - Integration Tests', () => {
  const userId = '507f1f77bcf86cd799439011';
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

  const validBudget = {
    name: 'Monthly Food',
    category: 'Food & Dining',
    amount: 500,
    period: 'monthly',
    description: 'Food budget'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET BUDGETS ──────────────────────────────────────────────────────────

  describe('GET /api/budgets', () => {
    it('should return budgets for authenticated user', async () => {
      Budget.find.mockReturnValue(chainable([]));

      const res = await request(app)
        .get('/api/budgets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/budgets');
      expect(res.status).toBe(401);
    });
  });

  // ─── CREATE BUDGET ────────────────────────────────────────────────────────

  describe('POST /api/budgets', () => {
    it('should create a budget successfully', async () => {
      Transaction.aggregate.mockResolvedValue([]);
      Budget.mockImplementation((data) => {
        const inst = { ...data, _id: 'mock-budget-id' };
        inst.save = jest.fn().mockResolvedValue(inst);
        return inst;
      });

      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send(validBudget);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe(validBudget.name);
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'Food & Dining' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid period', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBudget, period: 'biweekly' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid period/i);
    });
  });

  // ─── UPDATE BUDGET ────────────────────────────────────────────────────────

  describe('PUT /api/budgets/:id', () => {
    it('should update budget successfully', async () => {
      const mockBudget = {
        _id: 'mock-budget-id',
        userId,
        name: 'Monthly Food',
        status: 'active',
        categories: [{ category: 'Food & Dining', budgetedAmount: 500, spentAmount: 0 }],
        totalBudget: 500,
        save: jest.fn().mockResolvedValue(true)
      };
      Budget.findOne.mockResolvedValue(mockBudget);

      const res = await request(app)
        .put('/api/budgets/mock-budget-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Budget' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    it('should return 404 for non-existent budget', async () => {
      Budget.findOne.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/budgets/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE BUDGET ────────────────────────────────────────────────────────

  describe('DELETE /api/budgets/:id', () => {
    it('should delete a budget successfully', async () => {
      Budget.findOne.mockResolvedValue({ _id: 'mock-budget-id', userId });
      Budget.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete('/api/budgets/mock-budget-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it('should return 404 when deleting non-existent budget', async () => {
      Budget.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/budgets/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
