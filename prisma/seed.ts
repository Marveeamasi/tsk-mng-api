import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up existing data
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const password = await bcrypt.hash('Password123!', 12);

  const alice = await prisma.user.create({
    data: { name: 'Alice Johnson', email: 'alice@example.com', passwordHash: password, role: 'ADMIN' },
  });

  const bob = await prisma.user.create({
    data: { name: 'Bob Smith', email: 'bob@example.com', passwordHash: password, role: 'USER' },
  });

  const carol = await prisma.user.create({
    data: { name: 'Carol White', email: 'carol@example.com', passwordHash: password, role: 'USER' },
  });

  // Create project
  const project = await prisma.project.create({
    data: {
      name: 'TaskFlow Launch',
      description: 'Main project for the TaskFlow product launch',
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'ADMIN' },
          { userId: carol.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // Create tasks
  const task1 = await prisma.task.create({
    data: {
      title: 'Design database schema',
      description: 'Create the initial PostgreSQL schema with proper indexes',
      status: 'DONE',
      priority: 'HIGH',
      tags: ['backend', 'database'],
      creatorId: alice.id,
      assigneeId: alice.id,
      projectId: project.id,
      completedAt: new Date(),
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Implement authentication',
      description: 'JWT-based auth with refresh token rotation',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      tags: ['backend', 'security'],
      creatorId: alice.id,
      assigneeId: bob.id,
      projectId: project.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.task.create({
    data: {
      title: 'Write API documentation',
      status: 'TODO',
      priority: 'MEDIUM',
      tags: ['docs'],
      creatorId: bob.id,
      assigneeId: carol.id,
      projectId: project.id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.task.create({
    data: {
      title: 'Set up CI/CD pipeline',
      status: 'TODO',
      priority: 'URGENT',
      tags: ['devops'],
      creatorId: alice.id,
      projectId: project.id,
    },
  });

  // Add comments
  await prisma.comment.create({
    data: { body: 'Schema looks great! Added indexes for all common queries.', taskId: task1.id, authorId: alice.id },
  });

  await prisma.comment.create({
    data: { body: 'Working on refresh token rotation now.', taskId: task2.id, authorId: bob.id },
  });

  await prisma.comment.create({
    data: { body: 'Make sure to handle token reuse detection!', taskId: task2.id, authorId: alice.id },
  });

  console.log(`
✅ Seed complete!

Test accounts (password: Password123!):
  Admin: alice@example.com
  User:  bob@example.com
  User:  carol@example.com
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
