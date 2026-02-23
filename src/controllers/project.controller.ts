import { Request, Response } from 'express';
import Joi from 'joi';
import { projectService } from '../services/project.service';
import { validate } from '../utils/validate';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';

const createProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).optional(),
});

const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).allow(null).optional(),
});

const addMemberSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  role: Joi.string().valid('ADMIN', 'MEMBER', 'VIEWER').default('MEMBER'),
});

export const projectController = {
  async create(req: Request, res: Response) {
    const input = validate(createProjectSchema, req.body);
    const project = await projectService.create(input, req.user!.userId);
    sendCreated(res, project, 'Project created');
  },

  async findAll(req: Request, res: Response) {
    const result = await projectService.findAll(req.user!.userId, req.query as Record<string, unknown>);
    sendSuccess(res, result.projects, 'Projects fetched', 200, result.meta);
  },

  async findById(req: Request, res: Response) {
    const project = await projectService.findById(req.params.id, req.user!.userId);
    sendSuccess(res, project);
  },

  async update(req: Request, res: Response) {
    const input = validate(updateProjectSchema, req.body);
    const project = await projectService.update(req.params.id, input, req.user!.userId);
    sendSuccess(res, project, 'Project updated');
  },

  async delete(req: Request, res: Response) {
    await projectService.delete(req.params.id, req.user!.userId);
    sendNoContent(res);
  },

  async addMember(req: Request, res: Response) {
    const { email, role } = validate(addMemberSchema, req.body);
    const member = await projectService.addMember(req.params.id, email, role, req.user!.userId);
    sendCreated(res, member, 'Member added');
  },

  async removeMember(req: Request, res: Response) {
    await projectService.removeMember(req.params.id, req.params.memberId, req.user!.userId);
    sendNoContent(res);
  },
};
