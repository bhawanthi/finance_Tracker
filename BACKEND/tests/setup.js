/**
 * Integration test setup - configure environment variables
 * Models are mocked individually in each test file,
 * so no real database connection is needed.
 */
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.NODE_ENV = 'test';
