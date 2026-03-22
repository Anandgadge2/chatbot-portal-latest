import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User, { IUser } from '../models/User';
import { getAccessValidationError, resolveAccessContext } from '../utils/accessControl';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      access?: {
        isSuperAdmin: boolean;
        filteredPermissions: Array<{ module: string; actions: string[] }>;
        level: number;
        scope: 'platform' | 'company';
      };
    }
  }
}

const attachAccessContext = async (user: IUser): Promise<{ user: IUser; accessContext: Awaited<ReturnType<typeof resolveAccessContext>>; accessError: ReturnType<typeof getAccessValidationError> | null }> => {
  user.isSuperAdmin = user.isSuperAdmin || user.role === 'SUPER_ADMIN';

  if (user.isSuperAdmin) {
    user.filteredPermissions = [{ module: '*', actions: ['*'] }];
    user.level = 0;
    user.scope = 'platform';
    user.role = 'SUPER_ADMIN';

    return {
      user,
      accessContext: {
        company: null,
        role: null,
        filteredPermissions: user.filteredPermissions,
        level: 0,
        scope: 'platform',
        requiredModuleMissing: false,
        roleMissing: false
      },
      accessError: null
    };
  }

  const accessContext = await resolveAccessContext(user);

  user.filteredPermissions = accessContext.filteredPermissions;
  user.level = accessContext.level;
  user.scope = accessContext.scope;
  user.role = accessContext.role?.name || 'CUSTOM';

  return {
    user,
    accessContext,
    accessError: getAccessValidationError(user, accessContext)
  };
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

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User no longer active'
      });
      return;
    }

    const { user: resolvedUser, accessContext, accessError } = await attachAccessContext(user);

    if (!resolvedUser.isSuperAdmin && decoded.permissionsVersion !== accessContext.company?.permissionsVersion) {
      res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
      return;
    }

    if (accessError) {
      res.status(accessError.statusCode).json({ success: false, message: accessError.message });
      return;
    }

    req.user = resolvedUser;
    req.access = {
      isSuperAdmin: resolvedUser.isSuperAdmin,
      filteredPermissions: resolvedUser.filteredPermissions || [],
      level: resolvedUser.level || 0,
      scope: resolvedUser.scope || 'company'
    };
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Authentication error.'
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
        const { user: resolvedUser, accessError } = await attachAccessContext(user);
        if (!accessError) {
          req.user = resolvedUser;
          req.access = {
            isSuperAdmin: resolvedUser.isSuperAdmin,
            filteredPermissions: resolvedUser.filteredPermissions || [],
            level: resolvedUser.level || 0,
            scope: resolvedUser.scope || 'company'
          };
        }
      }
    }

    next();
  } catch (_error) {
    next();
  }
};
