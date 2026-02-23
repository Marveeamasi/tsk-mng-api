import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import bcrypt from 'bcryptjs';

const app = createApp();

describe('Tasks API', () => {
  let accessToken: string;
  let userId: string;
  let taskId: string;

  const email = `tasks-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    // Create a user directly in DB for speed
    const user = await prisma.user.create({
      data: {
        name: 'Task Tester',
        email,
        passwordHash: await bcrypt.hash('Password123!', 4),
        role: 'USER',
      },
    });
    userId = user.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123!' });
    accessToken = loginRes.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { creatorId: userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  describe('POST /api/tasks', () => {
    it('should create a task', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'My first task', priority: 'HIGH', tags: ['test'] })
        .expect(201);

      expect(res.body.data.title).toBe('My first task');
      expect(res.body.data.status).toBe('TODO');
      taskId = res.body.data.id;
    });

    it('should reject empty title', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/tasks', () => {
    it('should return paginated tasks', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/tasks?status=TODO')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      res.body.data.forEach((task: { status: string }) => {
        expect(task.status).toBe('TODO');
      });
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('should update a task status', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(res.body.data.status).toBe('IN_PROGRESS');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task', async () => {
      await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('should return 404 for deleted task', async () => {
      await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
