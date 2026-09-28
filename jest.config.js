export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, diagnostics: false }],
  },
  // The sources live in src/, while the tests retain the historical
  // tools/coding-lint/ import paths.
  moduleNameMapper: {
    '^(.*/)?tools/coding-lint/(.*)$': '<rootDir>/src/$2',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^tests/(.*)$': '<rootDir>/tests/$1',
  },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.spec.ts', '<rootDir>/__tests__/**/*.ts'],
  testTimeout: 10000,
};
