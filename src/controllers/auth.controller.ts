import { Request, Response } from 'express';
import Joi from 'joi';
import { authService } from '../services/auth.service';
import { validate } from '../utils/validate';
import { sendSuccess, sendCreated } from '../utils/response';

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters',
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const authController = {
  async register(req: Request, res: Response) {
    const input = validate(registerSchema, req.body);
    const result = await authService.register(input);
    sendCreated(res, result, 'Account created successfully');
  },

  async login(req: Request, res: Response) {
    const input = validate(loginSchema, req.body);
    const result = await authService.login(input);
    sendSuccess(res, result, 'Login successful');
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = validate(refreshSchema, req.body);
    const tokens = await authService.refreshTokens(refreshToken);
    sendSuccess(res, tokens, 'Tokens refreshed');
  },

  async logout(req: Request, res: Response) {
    await authService.logout(req.user!.userId);
    sendSuccess(res, null, 'Logged out successfully');
  },

  async getProfile(req: Request, res: Response) {
    const user = await authService.getProfile(req.user!.userId);
    sendSuccess(res, user);
  },
};
