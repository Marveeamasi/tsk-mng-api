import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
  tokens: AuthTokens;
}

const SALT_ROUNDS = 12;

const sanitizeUser = (user: {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

const generateTokens = (user: { id: string; email: string; role: string }): AuthTokens => ({
  accessToken: signAccessToken({ userId: user.id, email: user.email, role: user.role }),
  refreshToken: signRefreshToken({ userId: user.id, email: user.email, role: user.role }),
});

export const authService = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'USER',
      },
    });

    const tokens = generateTokens(user);

    // Store refresh token hash in DB
    await prisma.refreshToken.create({
      data: {
        token: await bcrypt.hash(tokens.refreshToken, 8),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { user: sanitizeUser(user), tokens };
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Invalid email or password');

    const tokens = generateTokens(user);

    // Rotate refresh tokens: delete old ones, insert new
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.create({
      data: {
        token: await bcrypt.hash(tokens.refreshToken, 8),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { user: sanitizeUser(user), tokens };
  },

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = verifyRefreshToken(refreshToken);

    const storedTokens = await prisma.refreshToken.findMany({
      where: { userId: payload.userId, expiresAt: { gt: new Date() } },
    });

    // Verify against stored hashes
    let isValid = false;
    for (const stored of storedTokens) {
      if (await bcrypt.compare(refreshToken, stored.token)) {
        isValid = true;
        break;
      }
    }

    if (!isValid) throw new UnauthorizedError('Refresh token invalid or expired');

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new NotFoundError('User');

    const newTokens = generateTokens(user);

    // Rotate: delete all old refresh tokens, create new one
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.create({
      data: {
        token: await bcrypt.hash(newTokens.refreshToken, 8),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return newTokens;
  },

  async logout(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new NotFoundError('User');
    return user;
  },
};
