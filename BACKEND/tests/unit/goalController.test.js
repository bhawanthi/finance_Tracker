const goalController = require('../../controllers/goalController');
const Goal = require('../../models/Goal');
const Transaction = require('../../models/Transaction');

jest.mock('../../models/Goal');
jest.mock('../../models/Transaction');

describe('Goal Controller - Unit Tests', () => {
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

  // ─── GET GOALS ─────────────────────────────────────────────────────────────

  describe('getGoals()', () => {
    it('should return goals with calculated fields', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const mockGoals = [
        {
          _id: 'goal1',
          name: 'Emergency Fund',
          targetAmount: 5000,
          currentAmount: 2500,
          targetDate: futureDate,
          status: 'active',
          progressPercentage: 50,
          toObject: jest.fn().mockReturnValue({
            _id: 'goal1',
            name: 'Emergency Fund',
            targetAmount: 5000,
            currentAmount: 2500
          })
        }
      ];
      Goal.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockGoals) });

      await goalController.getGoals(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ remainingAmount: 2500 })
        ])
      );
    });

    it('should return 500 on server error', async () => {
      Goal.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('DB error'))
      });
      await goalController.getGoals(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });

  // ─── CREATE GOAL ────────────────────────────────────────────────────────────

  describe('createGoal()', () => {
    const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    it('should return 400 if required fields are missing', async () => {
      req.body = { name: 'Vacation' };
      await goalController.createGoal(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Name, target amount, and target date are required'
      });
    });

    it('should return 400 if targetAmount is zero or negative', async () => {
      req.body = { name: 'Car', targetAmount: -1000, targetDate: futureDate };
      await goalController.createGoal(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Target amount must be greater than 0'
      });
    });

    it('should return 400 if targetDate is in the past', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      req.body = { name: 'Car', targetAmount: 10000, targetDate: pastDate };
      await goalController.createGoal(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Target date must be in the future'
      });
    });

    it('should create goal with milestones successfully', async () => {
      req.body = { name: 'House', targetAmount: 50000, targetDate: futureDate };
      const mockGoalInstance = {
        save: jest.fn().mockResolvedValue({}),
        toObject: jest.fn().mockReturnValue({ name: 'House', targetAmount: 50000 }),
        progressPercentage: 0
      };
      Goal.mockImplementation(() => mockGoalInstance);

      // generateGoalAnalysis calls Transaction.find internally — mock it
      Transaction.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      Transaction.aggregate = jest.fn().mockResolvedValue([]);

      await goalController.createGoal(req, res);

      expect(mockGoalInstance.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 500 on server error', async () => {
      req.body = { name: 'House', targetAmount: 50000, targetDate: futureDate };
      Goal.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('DB error'))
      }));
      await goalController.createGoal(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── UPDATE GOAL ────────────────────────────────────────────────────────────

  describe('updateGoal()', () => {
    it('should return 404 if goal not found', async () => {
      req.params = { id: 'nonexistent' };
      req.body = { name: 'Updated Goal' };
      Goal.findOne.mockResolvedValue(null);

      await goalController.updateGoal(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Goal not found' });
    });

    it('should return 400 if goal is already completed', async () => {
      req.params = { id: 'goal1' };
      req.body = { name: 'Updated' };
      Goal.findOne.mockResolvedValue({ status: 'completed', _id: 'goal1' });

      await goalController.updateGoal(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cannot update completed goal' });
    });

    it('should auto-complete goal when currentAmount reaches targetAmount', async () => {
      req.params = { id: 'goal1' };
      req.body = { currentAmount: 5000 };
      const mockGoal = {
        _id: 'goal1',
        status: 'active',
        targetAmount: 5000,
        currentAmount: 0,
        milestones: [],
        progressPercentage: 100,
        save: jest.fn().mockResolvedValue({}),
        toObject: jest.fn().mockReturnValue({ _id: 'goal1', status: 'completed' })
      };
      Goal.findOne.mockResolvedValue(mockGoal);

      await goalController.updateGoal(req, res);
      expect(mockGoal.status).toBe('completed');
      expect(mockGoal.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Goal updated successfully' })
      );
    });

    it('should update goal fields successfully', async () => {
      req.params = { id: 'goal1' };
      req.body = { name: 'New Name', priority: 'high' };
      const mockGoal = {
        _id: 'goal1',
        status: 'active',
        targetAmount: 5000,
        currentAmount: 1000,
        milestones: [],
        progressPercentage: 20,
        save: jest.fn().mockResolvedValue({}),
        toObject: jest.fn().mockReturnValue({ _id: 'goal1', name: 'New Name' })
      };
      Goal.findOne.mockResolvedValue(mockGoal);

      await goalController.updateGoal(req, res);
      expect(mockGoal.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Goal updated successfully' })
      );
    });
  });
});
