import "@testing-library/jest-dom/vitest";

// Set required env vars before any module that uses @/lib/env is loaded
// Run tests with NODE_ENV=test (set in package.json test script)
process.env.GOOGLE_GENAI_API_KEY = "test-api-key";
process.env.MONGODB_URI = "mongodb://test:test@localhost:27017/test";
process.env.NEXTAUTH_SECRET = "test-secret-at-least-32-chars-long";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
