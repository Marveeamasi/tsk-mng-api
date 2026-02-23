import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors';
import { buildPaginationMeta, parsePagination } from '../utils/response';

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
}

const projectSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  _count: { select: { tasks: true, members: true } },
} satisfies Prisma.ProjectSelect;

export const projectService = {
  async create(input: CreateProjectInput, ownerId: string) {
    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        ownerId,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
      select: projectSelect,
    });
    return project;
  },

  async findAll(userId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePagination(query);

    const where: Prisma.ProjectWhereInput = {
      members: { some: { userId } },
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, select: projectSelect, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.project.count({ where }),
    ]);

    return { projects, meta: buildPaginationMeta(page, limit, total) };
  },

  async findById(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ...projectSelect,
        members: {
          select: {
            role: true,
            joinedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!project) throw new NotFoundError('Project');

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!isMember) throw new ForbiddenError('You are not a member of this project');

    return project;
  },

  async update(projectId: string, input: UpdateProjectInput, userId: string) {
    await this.requireRole(projectId, userId, ['OWNER', 'ADMIN']);

    return prisma.project.update({
      where: { id: projectId },
      data: input,
      select: projectSelect,
    });
  },

  async delete(projectId: string, userId: string) {
    await this.requireRole(projectId, userId, ['OWNER']);
    await prisma.project.delete({ where: { id: projectId } });
  },

  async addMember(projectId: string, memberEmail: string, role: string, requesterId: string) {
    await this.requireRole(projectId, requesterId, ['OWNER', 'ADMIN']);

    const userToAdd = await prisma.user.findUnique({ where: { email: memberEmail } });
    if (!userToAdd) throw new NotFoundError('User');

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: userToAdd.id } },
    });
    if (existing) throw new ConflictError('User is already a member of this project');

    return prisma.projectMember.create({
      data: { projectId, userId: userToAdd.id, role },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async removeMember(projectId: string, memberId: string, requesterId: string) {
    const member = await this.requireRole(projectId, requesterId, ['OWNER', 'ADMIN']);
    if (member.role !== 'OWNER' && memberId !== requesterId) {
      throw new ForbiddenError('Only owners can remove members');
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: memberId } },
    });
  },

  // ── Private helpers ──────────────────────────────────────────────────────

  async requireRole(projectId: string, userId: string, allowedRoles: string[]) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) throw new ForbiddenError('You are not a member of this project');
    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenError(`Required role: ${allowedRoles.join(' or ')}`);
    }
    return membership;
  },
};
