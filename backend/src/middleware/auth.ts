import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User, { IUser } from '../models/User';
import { AuthContext, buildAuthContext, resolveUserAccessContext } from '../utils/accessControl';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      auth?: AuthContext;
    }
  }
}

const attachRequestAuth = (req: Request, user: IUser, auth: AuthContext) => {
  (user as any).role = auth.isSuperAdmin ? 'SUPER_ADMIN' : undefined;
  req.user = user;
  req.auth = auth;
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Authentication required.'
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('+password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found. Invalid token.'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account is inactive.'
      });
      return;
    }

    const { role, filteredPermissions } = await resolveUserAccessContext(user);
    const auth = buildAuthContext(user, role, filteredPermissions);

    attachRequestAuth(req, user, auth);
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ success: false, message: 'Invalid token.' });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
      return;
    }

    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Authentication error.',
      error: error.message
    });
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        const { role, filteredPermissions } = await resolveUserAccessContext(user);
        attachRequestAuth(req, user, buildAuthContext(user, role, filteredPermissions));
      }
    }

    next();
  } catch (_error) {
    next();
  }
};
