module.exports = {
    moduleFileExtensions: [
        'js',
        'jsx',
        'json',
        'vue',
        'ts',
        'tsx'
    ],
    automock: false,
    resetMocks: true,
    transform: {
        '^.+\\.vue$': 'vue-jest',
        '.+\\.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$': 'jest-transform-stub',
        '^.+\\.tsx?$': 'ts-jest'
    },
    cacheDirectory: "<rootDir>/.jest-cache",
    collectCoverage: false,
    coverageDirectory: "buildreports",
    collectCoverageFrom: [
        "**/src/**/*.ts",
        "!**/src/views/**"
    ],
    reporters: [
        "default",
        "jest-junit"
    ],
    setupTestFrameworkScriptFile: "./tests/setup.ts",
    transformIgnorePatterns: [
        "node_modules/*"
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    roots: [
        "<rootDir>/tests"
    ],
    snapshotSerializers: [
        'jest-serializer-vue'
    ],
    testMatch: [
        '**/tests/**/*.spec.(js|jsx|ts|tsx)|**/__tests__/*.(js|jsx|ts|tsx)',
        // use the below as an example if you'd like to perf-test test startup
        // '<rootDir>/tests/components/ab-landing/ab-landing.spec.ts'
    ],
    testURL: 'http://localhost/'
};
