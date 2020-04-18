const path = require('path');

module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: process.env.GITHUB_ACTIONS ? ['lcovonly', 'text'] : ['html', 'lcov', 'text'],
  coverageThreshold: {
    global: {
      branches: 93,
      functions: 100,
      lines: 100,
    },
  },
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^@minddocdev/mou-deploy-action/(.*)$': '<rootDir>/src/$1',
    '^@minddocdev/mou-deploy-action/test/(.*)$': '<rootDir>/test/$1',
  },
  preset: 'ts-jest',
  rootDir: path.resolve(__dirname),
  setupFiles: ['<rootDir>/test/setup.ts'],
  testEnvironment: require.resolve(`jest-environment-node`),
  testMatch: ['**/*.spec.ts'],
  verbose: true,
};
