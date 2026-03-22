const Category = require('../models/Category');

// Get all categories
const getCategories = async (req, res) => {
  try {
    const { type } = req.query;
    
    let filter = { isActive: true };
    if (type && type !== 'both') {
      filter.$or = [{ type }, { type: 'both' }];
    }

    const categories = await Category.find(filter).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Seed default categories
const seedDefaultCategories = async (req, res) => {
  try {
    const defaultCategories = [
      // Income Categories
      {
        name: 'Salary',
        type: 'income',
        icon: '💼',
        color: '#4CAF50',
        isDefault: true,
        subcategories: [
          { name: 'Primary Job', icon: '👔' },
          { name: 'Secondary Job', icon: '📋' },
          { name: 'Overtime', icon: '⏰' }
        ]
      },
      {
        name: 'Freelancing',
        type: 'income',
        icon: '💻',
        color: '#2196F3',
        isDefault: true,
        subcategories: [
          { name: 'Design Work', icon: '🎨' },
          { name: 'Programming', icon: '👨‍💻' },
          { name: 'Consulting', icon: '📊' }
        ]
      },
      {
        name: 'Investment',
        type: 'income',
        icon: '📈',
        color: '#FF9800',
        isDefault: true,
        subcategories: [
          { name: 'Dividends', icon: '💰' },
          { name: 'Interest', icon: '🏦' },
          { name: 'Capital Gains', icon: '📊' }
        ]
      },
      {
        name: 'Other Income',
        type: 'income',
        icon: '💡',
        color: '#9C27B0',
        isDefault: true,
        subcategories: [
          { name: 'Gifts', icon: '🎁' },
          { name: 'Refunds', icon: '↩️' },
          { name: 'Bonus', icon: '🎉' }
        ]
      },
      
      // Expense Categories
      {
        name: 'Food & Dining',
        type: 'expense',
        icon: '🍽️',
        color: '#F44336',
        isDefault: true,
        subcategories: [
          { name: 'Groceries', icon: '🛒' },
          { name: 'Restaurants', icon: '🍽️' },
          { name: 'Fast Food', icon: '🍔' },
          { name: 'Coffee', icon: '☕' }
        ]
      },
      {
        name: 'Transportation',
        type: 'expense',
        icon: '🚗',
        color: '#FF5722',
        isDefault: true,
        subcategories: [
          { name: 'Gas', icon: '⛽' },
          { name: 'Public Transit', icon: '🚌' },
          { name: 'Uber/Taxi', icon: '🚕' },
          { name: 'Parking', icon: '🅿️' },
          { name: 'Car Maintenance', icon: '🔧' }
        ]
      },
      {
        name: 'Bills & Utilities',
        type: 'expense',
        icon: '📄',
        color: '#607D8B',
        isDefault: true,
        subcategories: [
          { name: 'Electricity', icon: '⚡' },
          { name: 'Water', icon: '💧' },
          { name: 'Gas', icon: '🔥' },
          { name: 'Internet', icon: '🌐' },
          { name: 'Phone', icon: '📱' }
        ]
      },
      {
        name: 'Entertainment',
        type: 'expense',
        icon: '🎬',
        color: '#E91E63',
        isDefault: true,
        subcategories: [
          { name: 'Movies', icon: '🎥' },
          { name: 'Streaming', icon: '📺' },
          { name: 'Games', icon: '🎮' },
          { name: 'Books', icon: '📚' },
          { name: 'Hobbies', icon: '🎨' }
        ]
      },
      {
        name: 'Shopping',
        type: 'expense',
        icon: '🛍️',
        color: '#9C27B0',
        isDefault: true,
        subcategories: [
          { name: 'Clothing', icon: '👕' },
          { name: 'Electronics', icon: '📱' },
          { name: 'Home & Garden', icon: '🏠' },
          { name: 'Personal Care', icon: '💄' }
        ]
      },
      {
        name: 'Healthcare',
        type: 'expense',
        icon: '🏥',
        color: '#4CAF50',
        isDefault: true,
        subcategories: [
          { name: 'Doctor Visits', icon: '👩‍⚕️' },
          { name: 'Pharmacy', icon: '💊' },
          { name: 'Dental', icon: '🦷' },
          { name: 'Vision', icon: '👓' }
        ]
      },
      {
        name: 'Education',
        type: 'expense',
        icon: '🎓',
        color: '#3F51B5',
        isDefault: true,
        subcategories: [
          { name: 'Tuition', icon: '🏫' },
          { name: 'Books', icon: '📖' },
          { name: 'Courses', icon: '💻' },
          { name: 'Supplies', icon: '✏️' }
        ]
      },
      {
        name: 'Travel',
        type: 'expense',
        icon: '✈️',
        color: '#00BCD4',
        isDefault: true,
        subcategories: [
          { name: 'Flights', icon: '✈️' },
          { name: 'Hotels', icon: '🏨' },
          { name: 'Car Rental', icon: '🚗' },
          { name: 'Activities', icon: '🗺️' }
        ]
      },
      {
        name: 'Insurance',
        type: 'expense',
        icon: '🛡️',
        color: '#795548',
        isDefault: true,
        subcategories: [
          { name: 'Health Insurance', icon: '🏥' },
          { name: 'Car Insurance', icon: '🚗' },
          { name: 'Home Insurance', icon: '🏠' },
          { name: 'Life Insurance', icon: '❤️' }
        ]
      },
      {
        name: 'Other Expenses',
        type: 'expense',
        icon: '📦',
        color: '#757575',
        isDefault: true,
        subcategories: [
          { name: 'Miscellaneous', icon: '❓' },
          { name: 'Gifts', icon: '🎁' },
          { name: 'Donations', icon: '❤️' },
          { name: 'Fees', icon: '💳' }
        ]
      }
    ];

    // Idempotent seed: upsert by unique category name to avoid duplicate-key failures.
    await Category.bulkWrite(
      defaultCategories.map((category) => ({
        updateOne: {
          filter: { name: category.name },
          update: {
            $set: {
              type: category.type,
              icon: category.icon,
              color: category.color,
              subcategories: category.subcategories,
              isDefault: true,
              isActive: true
            }
          },
          upsert: true
        }
      }))
    );

    res.json({ message: 'Default categories seeded successfully' });
  } catch (error) {
    console.error('Seed categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCategories,
  seedDefaultCategories
};