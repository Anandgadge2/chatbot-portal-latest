import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { Permission, UserRole } from '../config/constants';


const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/audit
// @desc    Get audit logs (scoped by role)
// @access  Private
router.get('/', requirePermission(Permission.VIEW_AUDIT_LOGS), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, action, resource, userId, companyId, startDate, endDate } = req.query;
    const currentUser = req.user!;

    const query: any = {};

    // Scope based on user role
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      // Non-SuperAdmin users can only see logs for their company
      query.companyId = currentUser.companyId;
    } else if (companyId) {
      // SuperAdmin can filter by company
      query.companyId = companyId;
    }

    // Apply filters
    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (userId) query.userId = userId;

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate as string);
      }
    }

    const logs = await AuditLog.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('companyId', 'name companyId')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ timestamp: -1 });

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    });
  }
});

// @route   GET /api/audit/stats
// @desc    Get audit log statistics
// @access  Private (SuperAdmin only)
router.get('/stats', requirePermission(Permission.VIEW_AUDIT_LOGS), async (req: Request, res: Response) => {
  try {
    const { companyId, startDate, endDate } = req.query;

    const matchQuery: any = {};

    if (companyId) matchQuery.companyId = new mongoose.Types.ObjectId(companyId as string);

    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate as string);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate as string);
    }

    const stats = await AuditLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const resourceStats = await AuditLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$resource',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        actionStats: stats,
        resourceStats
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit statistics',
      error: error.message
    });
  }
});

export default router;
