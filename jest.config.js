export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, diagnostics: false }],
  },
  moduleNameMapper: {
    '^(documentation_validation|external|src|tests|test-runner)/(.*)$': '<rootDir>/$1/$2',
  },
  testEnvironment: 'node',
  maxWorkers: 2,
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.spec.ts', '<rootDir>/__tests__/**/*.ts'],
  testTimeout: 10000,
  workerIdleMemoryLimit: '1500MB',
};
