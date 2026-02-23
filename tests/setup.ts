import { prisma } from '../src/config/database';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-32-chars!!';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/taskflow_test';

afterAll(async () => {
  await prisma.$disconnect();
});
