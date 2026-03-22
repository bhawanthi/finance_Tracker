const budgetController = require('../../controllers/budgetController');
const Budget = require('../../models/Budget');
const Transaction = require('../../models/Transaction');

jest.mock('../../models/Budget');
jest.mock('../../models/Transaction');

describe('Budget Controller - Unit Tests', () => {
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

  // ─── GET BUDGETS ──────────────────────────────────────────────────────────────

  describe('getBudgets()', () => {
    it('should return list of budgets for user', async () => {
      const mockBudgets = [
        {
          _id: 'budget1',
          name: 'Food Budget',
          categories: [{ category: 'Food', spentAmount: 100 }],
          totalBudget: 500,
          period: 'monthly',
          startDate: new Date(),
          endDate: new Date()
        }
      ];
      Budget.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockBudgets)
      });

      await budgetController.getBudgets(req, res);
      expect(Budget.find).toHaveBeenCalledWith({ userId: '507f1f77bcf86cd799439011', status: 'active' });
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Food Budget', amount: 500 })
        ])
      );
    });

    it('should return 500 on server error', async () => {
      Budget.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('DB error'))
      });
      await budgetController.getBudgets(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── CREATE BUDGET ────────────────────────────────────────────────────────────

  describe('createBudget()', () => {
    const validBudgetBody = {
      name: 'Food Budget',
      category: 'Food & Dining',
      amount: '500',
      period: 'monthly'
    };

    it('should return 400 if required fields are missing', async () => {
      req.body = { name: 'Food Budget' };
      await budgetController.createBudget(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Please fill in all required fields' });
    });

    it('should return 400 for invalid period', async () => {
      req.body = { ...validBudgetBody, period: 'invalid' };
      Transaction.aggregate = jest.fn().mockResolvedValue([]);
      await budgetController.createBudget(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should create budget successfully with valid data', async () => {
      req.body = validBudgetBody;
      Transaction.aggregate = jest.fn().mockResolvedValue([{ total: 50 }]);
      const mockSavedBudget = {
        _id: 'budget123',
        name: 'Food Budget',
        categories: [{ category: 'Food & Dining', spentAmount: 50 }],
        totalBudget: 500,
        period: 'monthly',
        description: '',
        startDate: new Date(),
        endDate: new Date()
      };
      const mockSave = jest.fn().mockResolvedValue(mockSavedBudget);
      Budget.mockImplementation(() => ({ save: mockSave, ...mockSavedBudget }));

      await budgetController.createBudget(req, res);
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 500 on server error', async () => {
      req.body = validBudgetBody;
      Transaction.aggregate = jest.fn().mockRejectedValue(new Error('DB error'));
      await budgetController.createBudget(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── DELETE BUDGET ────────────────────────────────────────────────────────────

  describe('deleteBudget()', () => {
    it('should return 404 if budget not found', async () => {
      req.params = { id: 'nonexistent' };
      Budget.findOne.mockResolvedValue(null);
      await budgetController.deleteBudget(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Budget not found' });
    });

    it('should delete budget successfully', async () => {
      req.params = { id: 'budget123' };
      const mockBudget = { _id: 'budget123' };
      Budget.findOne.mockResolvedValue(mockBudget);
      Budget.deleteOne = jest.fn().mockResolvedValue({});
      await budgetController.deleteBudget(req, res);
      expect(Budget.deleteOne).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Budget deleted successfully' });
    });
  });
});
