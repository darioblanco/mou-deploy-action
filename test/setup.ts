/**
 * Unit test global mocks to external services.
 */

jest.mock('child_process', () => ({
  execSync: jest.fn(() => 'stdout'),
})); // Avoid running test commands in your computer (like a helm delete)
