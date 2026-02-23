import { Request, Response } from 'express';
import Joi from 'joi';
import { taskService } from '../services/task.service';
import { validate } from '../utils/validate';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';

const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(5000).optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM'),
  dueDate: Joi.date().iso().min('now').optional(),
  projectId: Joi.string().uuid().optional(),
  assigneeId: Joi.string().uuid().optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10).default([]),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(5000).allow(null).optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
  status: Joi.string().valid('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED').optional(),
  dueDate: Joi.date().iso().allow(null).optional(),
  assigneeId: Joi.string().uuid().allow(null).optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
});

const filterSchema = Joi.object({
  status: Joi.string().valid('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED').optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
  assigneeId: Joi.string().uuid().optional(),
  projectId: Joi.string().uuid().optional(),
  search: Joi.string().trim().max(100).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const commentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
});

export const taskController = {
  async create(req: Request, res: Response) {
    const input = validate(createTaskSchema, req.body);
    const task = await taskService.create(input, req.user!.userId);
    sendCreated(res, task, 'Task created');
  },

  async findAll(req: Request, res: Response) {
    const filters = validate(filterSchema, req.query);
    const result = await taskService.findAll(req.user!.userId, filters);
    sendSuccess(res, result.tasks, 'Tasks fetched', 200, result.meta);
  },

  async findById(req: Request, res: Response) {
    const task = await taskService.findById(req.params.id, req.user!.userId);
    sendSuccess(res, task);
  },

  async update(req: Request, res: Response) {
    const input = validate(updateTaskSchema, req.body);
    const task = await taskService.update(req.params.id, input, req.user!.userId);
    sendSuccess(res, task, 'Task updated');
  },

  async delete(req: Request, res: Response) {
    await taskService.delete(req.params.id, req.user!.userId);
    sendNoContent(res);
  },

  async addComment(req: Request, res: Response) {
    const { body } = validate(commentSchema, req.body);
    const comment = await taskService.addComment(req.params.id, body, req.user!.userId);
    sendCreated(res, comment, 'Comment added');
  },
};
