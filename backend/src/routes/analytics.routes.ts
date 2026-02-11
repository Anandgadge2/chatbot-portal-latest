import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Department from '../models/Department';
import User from '../models/User';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { Permission, UserRole, GrievanceStatus, AppointmentStatus } from '../config/constants';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard', requirePermission(Permission.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    // Build base query based on user role
    const baseQuery: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) baseQuery.companyId = companyId;
      if (departmentId) baseQuery.departmentId = departmentId;
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      baseQuery.companyId = currentUser.companyId;
      if (departmentId) baseQuery.departmentId = departmentId;
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN || currentUser.role === UserRole.OPERATOR || currentUser.role === UserRole.ANALYTICS_VIEWER) {
      // Department Admins, Operators, and Analytics Viewers see department-wide analytics
      baseQuery.departmentId = currentUser.departmentId;
    }

    // Get grievance statistics (exclude deleted)
    const totalGrievances = await Grievance.countDocuments({ ...baseQuery });
    const pendingGrievances = await Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.PENDING });
    const resolvedGrievances = await Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.RESOLVED });
    const assignedGrievancesCount = await Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.ASSIGNED });

    // Get appointment statistics (exclude deleted)
    const totalAppointments = await Appointment.countDocuments({ ...baseQuery });
    const requestedAppointments = await Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.REQUESTED });
    const scheduledAppointments = await Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.SCHEDULED });
    const confirmedAppointments = await Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.CONFIRMED });
    const completedAppointments = await Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.COMPLETED });
    const cancelledAppointments = await Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.CANCELLED });

    // Get department count (if applicable)
    let departmentCount = 0;
    if (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.COMPANY_ADMIN) {
      const deptQuery: any = {};
      if (currentUser.role === UserRole.COMPANY_ADMIN) {
        deptQuery.companyId = currentUser.companyId;
      } else if (companyId) {
        deptQuery.companyId = companyId;
      }
      departmentCount = await Department.countDocuments(deptQuery);
    }

    // Get user count (if applicable)
    let userCount = 0;
    if (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.COMPANY_ADMIN) {
      const userQuery: any = {};
      if (currentUser.role === UserRole.COMPANY_ADMIN) {
        userQuery.companyId = currentUser.companyId;
      } else if (companyId) {
        userQuery.companyId = companyId;
      }
      userCount = await User.countDocuments(userQuery);
    }

    // Get time-based statistics (last 7 days, 30 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const grievancesLast7Days = await Grievance.countDocuments({
      ...baseQuery,
      createdAt: { $gte: sevenDaysAgo }
    });
    const grievancesLast30Days = await Grievance.countDocuments({
      ...baseQuery,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const appointmentsLast7Days = await Appointment.countDocuments({
      ...baseQuery,
      createdAt: { $gte: sevenDaysAgo }
    });
    const appointmentsLast30Days = await Appointment.countDocuments({
      ...baseQuery,
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get daily statistics for last 7 days
    const dailyGrievances = await Grievance.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dailyAppointments = await Appointment.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Calculate resolution rate
    const resolutionRate = totalGrievances > 0 
      ? ((resolvedGrievances / totalGrievances) * 100).toFixed(1)
      : '0';

    // Calculate completion rate
    const completionRate = totalAppointments > 0
      ? ((completedAppointments / totalAppointments) * 100).toFixed(1)
      : '0';

    // Additional metrics (exclude deleted)
    const assignedGrievances = await Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.ASSIGNED });
    
    // SLA breach statistics (exclude deleted)
    const slaBreachedGrievances = await Grievance.countDocuments({ ...baseQuery, slaBreached: true });
    const slaComplianceRate = totalGrievances > 0
      ? (((totalGrievances - slaBreachedGrievances) / totalGrievances) * 100).toFixed(1)
      : '100';

    // Average resolution time (for resolved grievances)
    const avgResolutionTime = await Grievance.aggregate([
      { $match: { ...baseQuery, status: GrievanceStatus.RESOLVED, resolvedAt: { $exists: true } } },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: '$resolutionTime' }
        }
      }
    ]);

    // Grievances by priority (exclude deleted)
    const grievancesByPriority = await Grievance.aggregate([
      { $match: { ...baseQuery } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Appointments by department (exclude deleted)
    const appointmentsByDepartment = await Appointment.aggregate([
      { $match: { ...baseQuery } },
      {
        $group: {
          _id: '$departmentId',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          departmentId: '$_id',
          departmentName: '$department.name',
          count: 1,
          completed: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Monthly trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyGrievances = await Grievance.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthlyAppointments = await Appointment.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        grievances: {
          total: totalGrievances,
          pending: pendingGrievances,
          assigned: assignedGrievances,
          inProgress: assignedGrievancesCount, // For backward compatibility
          resolved: resolvedGrievances,
          last7Days: grievancesLast7Days,
          last30Days: grievancesLast30Days,
          resolutionRate: parseFloat(resolutionRate),
          slaBreached: slaBreachedGrievances,
          slaComplianceRate: parseFloat(slaComplianceRate),
          avgResolutionDays: avgResolutionTime.length > 0 ? parseFloat(avgResolutionTime[0].avgDays.toFixed(1)) : 0,
          byPriority: grievancesByPriority.map(g => ({ priority: g._id || 'MEDIUM', count: g.count })),
          daily: dailyGrievances.map(d => ({ date: d._id, count: d.count })),
          monthly: monthlyGrievances.map(m => ({ month: m._id, count: m.count, resolved: m.resolved }))
        },
        appointments: {
          total: totalAppointments,
          pending: requestedAppointments + scheduledAppointments, // REQUESTED + SCHEDULED
          requested: requestedAppointments,
          scheduled: scheduledAppointments,
          confirmed: confirmedAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments,
          last7Days: appointmentsLast7Days,
          last30Days: appointmentsLast30Days,
          completionRate: parseFloat(completionRate),
          byDepartment: appointmentsByDepartment,
          daily: dailyAppointments.map(d => ({ date: d._id, count: d.count })),
          monthly: monthlyAppointments.map(m => ({ month: m._id, count: m.count, completed: m.completed }))
        },
        departments: departmentCount,
        users: userCount,
        activeUsers: userCount > 0 ? await User.countDocuments({ ...baseQuery, isActive: true }) : 0
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/grievances/by-department
// @desc    Get grievance distribution by department
// @access  Private
router.get('/grievances/by-department', requirePermission(Permission.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId } = req.query;

    const matchQuery: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) matchQuery.companyId = new mongoose.Types.ObjectId(companyId as string);
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      matchQuery.companyId = currentUser.companyId;
    } else {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const distribution = await Grievance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$departmentId',
          count: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.PENDING] }, 1, 0] }
          },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          departmentId: '$_id',
          departmentName: '$department.name',
          count: 1,
          pending: 1,
          resolved: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: distribution
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department distribution',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/grievances/by-status
// @desc    Get grievance distribution by status
// @access  Private
router.get('/grievances/by-status', requirePermission(Permission.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const matchQuery: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) matchQuery.companyId = new mongoose.Types.ObjectId(companyId as string);
      if (departmentId) matchQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      matchQuery.companyId = currentUser.companyId;
      if (departmentId) matchQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      matchQuery.departmentId = currentUser.departmentId;
    }

    const distribution = await Grievance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: distribution
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch status distribution',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/grievances/trends
// @desc    Get grievance trends over time
// @access  Private
router.get('/grievances/trends', requirePermission(Permission.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId, days = 30 } = req.query;

    const matchQuery: any = {
      createdAt: {
        $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
      }
    };

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) matchQuery.companyId = new mongoose.Types.ObjectId(companyId as string);
      if (departmentId) matchQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      matchQuery.companyId = currentUser.companyId;
      if (departmentId) matchQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      matchQuery.departmentId = currentUser.departmentId;
    }

    const trends = await Grievance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grievance trends',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/appointments/by-date
// @desc    Get appointment distribution by date
// @access  Private
router.get('/appointments/by-date', requirePermission(Permission.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId, days = 30 } = req.query;

    const matchQuery: any = {
      appointmentDate: {
        $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
      }
    };

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) matchQuery.companyId = new mongoose.Types.ObjectId(companyId as string);
      if (departmentId) matchQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      matchQuery.companyId = currentUser.companyId;
      if (departmentId) matchQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      matchQuery.departmentId = currentUser.departmentId;
    }

    const distribution = await Appointment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$appointmentDate' }
          },
          count: { $sum: 1 },
          scheduled: {
            $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.SCHEDULED] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: distribution
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment distribution',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/performance
// @desc    Get performance metrics (response times, top performers, etc.)
// @access  Private
router.get('/performance', requirePermission(Permission.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const baseQuery: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) baseQuery.companyId = new mongoose.Types.ObjectId(companyId as string);
      if (departmentId) baseQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      baseQuery.companyId = currentUser.companyId;
      if (departmentId) baseQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      baseQuery.departmentId = currentUser.departmentId;
    }

    // Top performing departments (by resolution rate)
    const topDepartments = await Grievance.aggregate([
      { $match: { ...baseQuery, departmentId: { $exists: true } } },
      {
        $group: {
          _id: '$departmentId',
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          departmentId: '$_id',
          departmentName: '$department.name',
          total: 1,
          resolved: 1,
          resolutionRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$resolved', '$total'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { resolutionRate: -1 } },
      { $limit: 10 }
    ]);

    // Top performing operators (by resolution count)
    const topOperators = await Grievance.aggregate([
      { $match: { ...baseQuery, assignedTo: { $exists: true }, status: GrievanceStatus.RESOLVED } },
      {
        $group: {
          _id: '$assignedTo',
          resolved: { $sum: 1 },
          avgResolutionDays: {
            $avg: {
              $divide: [
                { $subtract: ['$resolvedAt', '$createdAt'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          userName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          resolved: 1,
          avgResolutionDays: { $round: ['$avgResolutionDays', 1] }
        }
      },
      { $sort: { resolved: -1 } },
      { $limit: 10 }
    ]);

    // Response time analysis (time to first assignment)
    const responseTimeAnalysis = await Grievance.aggregate([
      { $match: { ...baseQuery, assignedAt: { $exists: true } } },
      {
        $project: {
          responseTimeHours: {
            $divide: [
              { $subtract: ['$assignedAt', '$createdAt'] },
              1000 * 60 * 60
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTimeHours' },
          minResponseTime: { $min: '$responseTimeHours' },
          maxResponseTime: { $max: '$responseTimeHours' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        topDepartments,
        topOperators,
        responseTime: responseTimeAnalysis.length > 0 ? {
          avgHours: parseFloat(responseTimeAnalysis[0].avgResponseTime.toFixed(2)),
          minHours: parseFloat(responseTimeAnalysis[0].minResponseTime.toFixed(2)),
          maxHours: parseFloat(responseTimeAnalysis[0].maxResponseTime.toFixed(2))
        } : null
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance metrics',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/hourly
// @desc    Get hourly distribution of grievances and appointments
// @access  Private
router.get('/hourly', requirePermission(Permission.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId, days = 7 } = req.query;

    const baseQuery: any = {
      createdAt: {
        $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
      }
    };

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) baseQuery.companyId = new mongoose.Types.ObjectId(companyId as string);
      if (departmentId) baseQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      baseQuery.companyId = currentUser.companyId;
      if (departmentId) baseQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      baseQuery.departmentId = currentUser.departmentId;
    }

    const hourlyGrievances = await Grievance.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const hourlyAppointments = await Appointment.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        grievances: hourlyGrievances.map(h => ({ hour: h._id, count: h.count })),
        appointments: hourlyAppointments.map(h => ({ hour: h._id, count: h.count }))
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hourly distribution',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/category
// @desc    Get distribution by category
// @access  Private
router.get('/category', requirePermission(Permission.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const baseQuery: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) baseQuery.companyId = new mongoose.Types.ObjectId(companyId as string);
      if (departmentId) baseQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      baseQuery.companyId = currentUser.companyId;
      if (departmentId) baseQuery.departmentId = new mongoose.Types.ObjectId(departmentId as string);
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      baseQuery.departmentId = currentUser.departmentId;
    }

    const categoryDistribution = await Grievance.aggregate([
      { $match: { ...baseQuery, category: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: categoryDistribution.map(c => ({
        category: c._id,
        count: c.count,
        resolved: c.resolved
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category distribution',
      error: error.message
    });
  }
});

export default router;
