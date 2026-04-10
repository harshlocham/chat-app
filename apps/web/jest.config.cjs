module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  moduleNameMapper: {
    "^@/lib/socket/(.*)$": "<rootDir>/hooks/$1",
    "^@/(.*)$": "<rootDir>/$1",
  },
  clearMocks: true,
};
