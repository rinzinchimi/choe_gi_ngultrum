module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/utils/**/*.test.js'],
  verbose: true,
  setupFiles: ['<rootDir>/jest.setup.js'],
  testTimeout: 20000,
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/public/'
  ]
};

