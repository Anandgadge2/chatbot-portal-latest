import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Department from '../models/Department';
import User from '../models/User';
import { Permission, UserRole, GrievanceStatus, AppointmentStatus, Module } from '../config/constants';

const getAnalyticsBaseQuery = (req: any, companyId?: any, departmentId?: any) => {
  const query: any = {};
  const currentUser = req.user;

  if (currentUser.isSuperAdmin) {
    if (companyId) query.companyId = new mongoose.Types.ObjectId(companyId.toString());
    if (departmentId) query.departmentId = new mongoose.Types.ObjectId(departmentId.toString());
  } else {
    // All other roles are strictly scoped to their company
    query.companyId = currentUser.companyId;

    if (currentUser.departmentId) {
      // 🏢 HIERARCHICAL: Can see data in their department OR sub-department
      if (!req.checkPermission(Permission.ASSIGN_GRIEVANCE)) {
        query.assignedTo = currentUser._id;
      } else {
        query.$or = [
          { departmentId: currentUser.departmentId },
          { subDepartmentId: currentUser.departmentId }
        ];
      }
    } else if (departmentId) {
      // If company admin filters by department
      query.departmentId = new mongoose.Types.ObjectId(departmentId.toString());
    }
  }
  return query;
};

export const dashboard = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const baseQuery = getAnalyticsBaseQuery(req, companyId, departmentId);

    // Fetch company to check for modules
    const targetCompanyId = currentUser.companyId || companyId;
    const company = targetCompanyId ? await mongoose.model('Company').findById(targetCompanyId) as any : null;
    const isHierarchicalEnabled = company?.enabledModules?.includes(Module.HIERARCHICAL_DEPARTMENTS);

    // Get time-based statistics (last 7 days, 30 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 🚀 Performance Optimization: Parallelize all database queries
    const [
      totalGrievances,
      pendingGrievances,
      resolvedGrievances,
      assignedGrievancesCount,
      totalAppointments,
      requestedAppointments,
      scheduledAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      grievancesLast7Days,
      grievancesLast30Days,
      appointmentsLast7Days,
      appointmentsLast30Days,
      dailyGrievances,
      dailyAppointments,
      slaBreachedGrievances,
      assignedGrievances,
      departmentCount,
      userCount,
      mainDepartmentCount,
      subDepartmentCount,
      resolvedToday,
      highPriorityPending,
      urgentPriorityPending,
      deptCounts
    ] = await Promise.all([
      Grievance.countDocuments({ ...baseQuery }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.PENDING }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.RESOLVED }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.ASSIGNED }),
      
      Appointment.countDocuments({ ...baseQuery }),
      Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.REQUESTED }),
      Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.SCHEDULED }),
      Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.CONFIRMED }),
      Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.COMPLETED }),
      Appointment.countDocuments({ ...baseQuery, status: AppointmentStatus.CANCELLED }),
      
      Grievance.countDocuments({ ...baseQuery, createdAt: { $gte: sevenDaysAgo } }),
      Grievance.countDocuments({ ...baseQuery, createdAt: { $gte: thirtyDaysAgo } }),
      
      Appointment.countDocuments({ ...baseQuery, createdAt: { $gte: sevenDaysAgo } }),
      Appointment.countDocuments({ ...baseQuery, createdAt: { $gte: thirtyDaysAgo } }),
      
      Grievance.aggregate([
        { $match: { ...baseQuery, createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      Appointment.aggregate([
        { $match: { ...baseQuery, createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      Grievance.countDocuments({ ...baseQuery, slaBreached: true }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.ASSIGNED }),
      
      // Counts (Super Admin or those without a specific departmentId)
      Department.countDocuments({ companyId: currentUser.companyId || (companyId || { $exists: true }) }),
        
      User.countDocuments({ companyId: currentUser.companyId || (companyId || { $exists: true }) }),

      // Hierarchical Dept Counts
      isHierarchicalEnabled ? Department.countDocuments({ 
        companyId: targetCompanyId, 
        $or: [{ parentDepartmentId: null }, { parentDepartmentId: { $exists: false } }] 
      }) : Promise.resolve(0),
      
      isHierarchicalEnabled ? Department.countDocuments({ 
        companyId: targetCompanyId, 
        parentDepartmentId: { $ne: null } 
      }) : Promise.resolve(0),

      // More informative stats
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.RESOLVED, resolvedAt: { $gte: new Date().setHours(0,0,0,0) } }),
      Grievance.countDocuments({ ...baseQuery, priority: 'HIGH', status: { $ne: GrievanceStatus.RESOLVED } }),
      Grievance.countDocuments({ ...baseQuery, priority: 'URGENT', status: { $ne: GrievanceStatus.RESOLVED } }),
      targetCompanyId
        ? User.aggregate([
            { $match: { companyId: new mongoose.Types.ObjectId(targetCompanyId.toString()) } },
            { $group: { _id: '$departmentId', count: { $sum: 1 } } }
          ])
        : Promise.resolve([])
    ]);

    // Calculate resolution rate
    const resolutionRate = totalGrievances > 0 
      ? ((resolvedGrievances / totalGrievances) * 100).toFixed(1)
      : '0';

    // Calculate completion rate
    const completionRate = totalAppointments > 0
      ? ((completedAppointments / totalAppointments) * 100).toFixed(1)
      : '0';

    // SLA compliance rate
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

    // 👤 User distribution by role (Across whole company/scope)
    // This is more accurate than client-side grouping of paginated data
    const usersByRole = await User.aggregate([
      { $match: { ...baseQuery } },
      {
        $lookup: {
          from: 'roles',
          localField: 'customRoleId',
          foreignField: '_id',
          as: 'customRole'
        }
      },
      { $unwind: { path: '$customRole', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$isSuperAdmin', true] }, 'Platform Superadmin', '$customRole.name'] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
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
        mainDepartments: mainDepartmentCount,
        subDepartments: subDepartmentCount,
        users: userCount,
        activeUsers: userCount > 0 ? await User.countDocuments({ ...baseQuery, isActive: true }) : 0,
        resolvedToday: resolvedToday,
        highPriorityPending: highPriorityPending + urgentPriorityPending,
        isHierarchicalEnabled: !!isHierarchicalEnabled,
        deptCounts,
        usersByRole: usersByRole.reduce((acc: any[], current: any) => {
          const rawName = current._id || 'Unknown';
          const name = rawName.toString().replace(/_/g, ' ').toUpperCase();
          const existing = acc.find(a => a.name === name);
          if (existing) {
            existing.count += current.count;
          } else {
            acc.push({ name, count: current.count });
          }
          return acc;
        }, []).sort((a: any, b: any) => b.count - a.count)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }

};

export const grievancesByDepartment = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId } = req.query;

    const matchQuery = getAnalyticsBaseQuery(req, companyId);

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

};

export const grievancesByStatus = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const matchQuery = getAnalyticsBaseQuery(currentUser, companyId, departmentId);

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

};

export const grievancesTrends = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId, days = 30 } = req.query;

    const matchQuery = getAnalyticsBaseQuery(currentUser, companyId, departmentId);
    matchQuery.createdAt = {
      $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
    };

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

};

export const appointmentsByDate = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId, days = 30 } = req.query;

    const baseQuery = getAnalyticsBaseQuery(req, companyId, departmentId);
    const matchQuery: any = {
      ...baseQuery,
      appointmentDate: {
        $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
      }
    };

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

};

export const performance = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const baseQuery = getAnalyticsBaseQuery(req, companyId, departmentId);

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

};

export const hourly = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId, days = 7 } = req.query;

    const baseQuery = getAnalyticsBaseQuery(req, companyId, departmentId);
    baseQuery.createdAt = {
      $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
    };

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

};

export const category = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const baseQuery = getAnalyticsBaseQuery(req, companyId, departmentId);

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

};
