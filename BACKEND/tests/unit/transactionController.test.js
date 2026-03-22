const transactionController = require('../../controllers/transactionController');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');

jest.mock('../../models/Transaction');
jest.mock('../../models/Budget');

describe('Transaction Controller - Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: '507f1f77bcf86cd799439011' },
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  // ─── GET TRANSACTIONS ─────────────────────────────────────────────────────────

  describe('getTransactions()', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { _id: 'tx1', type: 'expense', amount: 100, category: 'Food', description: 'Lunch' }
      ];
      Transaction.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTransactions)
      });
      Transaction.countDocuments.mockResolvedValue(1);

      await transactionController.getTransactions(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          transactions: mockTransactions,
          totalTransactions: 1
        })
      );
    });

    it('should filter by type when provided', async () => {
      req.query = { type: 'expense' };
      Transaction.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });
      Transaction.countDocuments.mockResolvedValue(0);

      await transactionController.getTransactions(req, res);
      expect(Transaction.find).toHaveBeenCalledWith(expect.objectContaining({ type: 'expense' }));
    });

    it('should return 500 on server error', async () => {
      Transaction.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('DB error'))
      });
      await transactionController.getTransactions(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── ADD TRANSACTION ──────────────────────────────────────────────────────────

  describe('addTransaction()', () => {
    const validTransaction = {
      type: 'expense',
      amount: 100,
      category: 'Food & Dining',
      description: 'Lunch at restaurant'
    };

    it('should return 400 if required fields are missing', async () => {
      req.body = { type: 'expense' };
      await transactionController.addTransaction(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Please fill in all required fields' });
    });

    it('should return 400 if amount is zero or negative', async () => {
      req.body = { ...validTransaction, amount: -50 };
      await transactionController.addTransaction(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Amount must be greater than 0' });
    });

    it('should create income transaction successfully', async () => {
      req.body = { ...validTransaction, type: 'income' };
      const mockSave = jest.fn().mockResolvedValue({});
      Transaction.mockImplementation(() => ({ save: mockSave, ...req.body }));

      await transactionController.addTransaction(req, res);
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should create expense transaction and update budget', async () => {
      req.body = validTransaction;
      const mockSave = jest.fn().mockResolvedValue({});
      Transaction.mockImplementation(() => ({ save: mockSave, ...validTransaction }));
      Budget.findOneAndUpdate = jest.fn().mockResolvedValue({});

      await transactionController.addTransaction(req, res);
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 500 on server error', async () => {
      req.body = validTransaction;
      Transaction.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('DB error'))
      }));
      await transactionController.addTransaction(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── DELETE TRANSACTION ───────────────────────────────────────────────────────

  describe('deleteTransaction()', () => {
    it('should return 404 if transaction not found', async () => {
      req.params = { id: 'nonexistent' };
      Transaction.findOne.mockResolvedValue(null);
      await transactionController.deleteTransaction(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Transaction not found' });
    });

    it('should delete transaction successfully', async () => {
      req.params = { id: 'tx123' };
      const mockTx = {
        _id: 'tx123',
        type: 'expense',
        amount: 100,
        category: 'Food'
      };
      Transaction.findOne.mockResolvedValue(mockTx);
      Transaction.deleteOne = jest.fn().mockResolvedValue({});
      await transactionController.deleteTransaction(req, res);
      expect(Transaction.deleteOne).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Transaction deleted successfully' });
    });
  });
});
