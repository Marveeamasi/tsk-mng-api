import { Prisma, TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { buildPaginationMeta, parsePagination } from '../utils/response';

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: Date;
  projectId?: string;
  assigneeId?: string;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: Date | null;
  assigneeId?: string | null;
  tags?: string[];
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  projectId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskSelect;

export const taskService = {
  async create(input: CreateTaskInput, creatorId: string) {
    if (input.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: creatorId } } },
      });
      if (!project) throw new ForbiddenError('You are not a member of this project');
    }

    return prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority ?? 'MEDIUM',
        dueDate: input.dueDate,
        tags: input.tags ?? [],
        creatorId,
        projectId: input.projectId,
        assigneeId: input.assigneeId,
        status: 'TODO',
      },
      select: taskSelect,
    });
  },

  async findAll(userId: string, filters: TaskFilters) {
    const { page, limit, skip } = parsePagination(filters as Record<string, unknown>);

    const where: Prisma.TaskWhereInput = {
      OR: [{ creatorId: userId }, { assigneeId: userId }],
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters.projectId && { projectId: filters.projectId }),
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({ where, select: taskSelect, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.task.count({ where }),
    ]);

    return { tasks, meta: buildPaginationMeta(page, limit, total) };
  },

  async findById(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        ...taskSelect,
        comments: {
          select: {
            id: true, body: true, createdAt: true,
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) throw new NotFoundError('Task');
    if (task.creator.id !== userId && task.assignee?.id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    return task;
  },

  async update(taskId: string, input: UpdateTaskInput, userId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task');
    if (task.creatorId !== userId && task.assigneeId !== userId) {
      throw new ForbiddenError('Only the creator or assignee can update this task');
    }

    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...input,
        ...(input.status === 'DONE' && { completedAt: new Date() }),
        ...(input.status && input.status !== 'DONE' && { completedAt: null }),
      },
      select: taskSelect,
    });
  },

  async delete(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task');
    if (task.creatorId !== userId) {
      throw new ForbiddenError('Only the task creator can delete it');
    }
    await prisma.task.delete({ where: { id: taskId } });
  },

  async addComment(taskId: string, body: string, authorId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task');

    return prisma.comment.create({
      data: { body, taskId, authorId },
      select: {
        id: true, body: true, createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
  },
};
