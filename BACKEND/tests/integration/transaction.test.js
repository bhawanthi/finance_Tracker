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

const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
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

describe('Transaction Routes - Integration Tests', () => {
  const userId = '507f1f77bcf86cd799439011';
  const otherUserId = '607f1f77bcf86cd799439022';
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

  const validTransaction = {
    type: 'expense',
    amount: 50,
    category: 'Food & Dining',
    description: 'Lunch'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default Budget.findOne returns null so updateBudgetSpending is a no-op
    Budget.findOne.mockResolvedValue(null);
  });

  // ─── GET TRANSACTIONS ──────────────────────────────────────────────────────

  describe('GET /api/transactions', () => {
    it('should return transactions for authenticated user', async () => {
      Transaction.find.mockReturnValue(chainable([]));
      Transaction.countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('transactions');
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/transactions');
      expect(res.status).toBe(401);
    });
  });

  // ─── ADD TRANSACTION ──────────────────────────────────────────────────────

  describe('POST /api/transactions', () => {
    beforeEach(() => {
      Transaction.mockImplementation((data) => {
        const inst = { ...data, _id: 'mock-tx-id' };
        inst.save = jest.fn().mockResolvedValue(inst);
        return inst;
      });
    });

    it('should add an expense transaction successfully', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(validTransaction);

      expect(res.status).toBe(201);
      expect(res.body.transaction).toMatchObject({
        type: 'expense',
        amount: 50,
        category: 'Food & Dining'
      });
    });

    it('should add an income transaction successfully', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validTransaction, type: 'income', description: 'Salary', amount: 3000 });

      expect(res.status).toBe(201);
      expect(res.body.transaction.type).toBe('income');
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'expense' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if amount is zero', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validTransaction, amount: 0 });

      expect(res.status).toBe(400);
    });
  });

  // ─── UPDATE TRANSACTION ────────────────────────────────────────────────────

  describe('PUT /api/transactions/:id', () => {
    it('should update a transaction successfully', async () => {
      const mockTx = {
        _id: 'mock-tx-id',
        userId,
        type: 'expense',
        amount: 50,
        category: 'Food & Dining',
        description: 'Lunch',
        save: jest.fn().mockResolvedValue(true)
      };
      Transaction.findOne.mockResolvedValue(mockTx);

      const res = await request(app)
        .put('/api/transactions/mock-tx-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 75, description: 'Updated lunch' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    it('should return 404 for non-existent transaction', async () => {
      Transaction.findOne.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/transactions/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 100 });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE TRANSACTION ────────────────────────────────────────────────────

  describe('DELETE /api/transactions/:id', () => {
    it('should delete a transaction successfully', async () => {
      const mockTx = {
        _id: 'mock-tx-id',
        userId,
        type: 'expense',
        amount: 50,
        category: 'Food & Dining'
      };
      Transaction.findOne.mockResolvedValue(mockTx);
      Transaction.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete('/api/transactions/mock-tx-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it('should return 404 when deleting non-existent transaction', async () => {
      Transaction.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/transactions/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should not allow deleting another user\'s transaction', async () => {
      // Transaction belongs to userId, trying to delete as otherUserId
      Transaction.findOne.mockResolvedValue(null); // findOne({_id, userId: otherUserId}) → null
      const otherToken = jwt.sign({ id: otherUserId }, process.env.JWT_SECRET);

      const res = await request(app)
        .delete('/api/transactions/mock-tx-id')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });
});
