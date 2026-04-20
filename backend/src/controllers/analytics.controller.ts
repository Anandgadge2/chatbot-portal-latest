import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Department from '../models/Department';
import User from '../models/User';
import { getDepartmentHierarchyIds } from '../utils/departmentUtils';

import { Permission, UserRole, GrievanceStatus, AppointmentStatus, Module, SLA_CONFIG } from '../config/constants';

const getAnalyticsBaseQuery = async (req: any, companyId?: any, departmentId?: any) => {
  const query: any = {};
  const currentUser = req.user;

  if (currentUser.isSuperAdmin) {
    if (companyId) {
      query.companyId = new mongoose.Types.ObjectId(companyId.toString());
    }
    
    if (departmentId) {
      const deptId = new mongoose.Types.ObjectId(departmentId.toString());
      // 🏢 HIERARCHICAL: Check if this is a parent department to include sub-departments
      const subDeptIds = await Department.find({ 
        parentDepartmentId: deptId 
      }).distinct('_id');
      
      query.$or = [
        { departmentId: deptId },
        { subDepartmentId: deptId },
        { subDepartmentId: { $in: subDeptIds } }
      ];
    }
  } else {
    query.companyId = currentUser.companyId;

    const userLevel = currentUser.level !== undefined ? currentUser.level : 4;
    const assignedDeptIds = (currentUser.departmentIds && currentUser.departmentIds.length > 0)
      ? currentUser.departmentIds.map((id: string | mongoose.Types.ObjectId) => id.toString())
      : (currentUser.departmentId ? [currentUser.departmentId.toString()] : []);

    // Determine unauthorized request early
    if (userLevel === 1) { // Company Admin
      if (departmentId) {
        const deptId = new mongoose.Types.ObjectId(departmentId.toString());
        const allDeptIds = await getDepartmentHierarchyIds(deptId.toString());
        const mongoIds = allDeptIds.map(id => new mongoose.Types.ObjectId(id));
        query.$or = [
          { departmentId: { $in: mongoIds } },
          { subDepartmentId: { $in: mongoIds } }
        ];
      }
      // Otherwise, no department filter (sees all company data)
    } else {
      // 🛡️ HIERARCHICAL SCOPING for Level 2 & 3
      let authorizedDeptIds: string[] = [];
      if (userLevel === 2) {
        // Dept Admin sees their departments AND all descendants
        authorizedDeptIds = await getDepartmentHierarchyIds(assignedDeptIds);
      } else if (userLevel === 3) {
        // Sub-Dept Admin sees ONLY their assigned departments
        authorizedDeptIds = [...assignedDeptIds];
      } else {
        // Operator sees only assigned records (handled by assignedTo filter)
        query.assignedTo = currentUser._id;
        return query; 
      }

      // 🔍 FILTER VALIDATION: If a specific departmentId is requested, verify it's in authorized scope
      if (departmentId) {
        const requestedIdStr = departmentId.toString();
        if (authorizedDeptIds.includes(requestedIdStr)) {
          // Valid request: filter by this specific department (including its children if level 2)
          const nestedIds = userLevel === 2 ? await getDepartmentHierarchyIds(requestedIdStr) : [requestedIdStr];
          const mongoIds = nestedIds.map(id => new mongoose.Types.ObjectId(id));
          query.$or = [
            { departmentId: { $in: mongoIds } },
            { subDepartmentId: { $in: mongoIds } }
          ];
        } else {
          // ⚠️ SECURITY: Requested an unauthorized department. Force filter to empty or authorized scope.
          // For analytics, it's safer to just return nothing for the unauthorized filter.
          query._id = { $in: [] }; 
        }
      } else {
        // No filter requested: show full authorized scope
        const mongoIds = authorizedDeptIds.map(id => new mongoose.Types.ObjectId(id));
        query.$or = [
          { departmentId: { $in: mongoIds } },
          { subDepartmentId: { $in: mongoIds } }
        ];
      }
    }
  }
  return query;
};

export const dashboard = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const baseQuery = await getAnalyticsBaseQuery(req, companyId, departmentId);

    // 🔍 Extract authorized department IDs from user context for proper scoping of counts
    let authorizedMongoDeptIds: mongoose.Types.ObjectId[] = [];
    const currentAssignedDeptIds = (currentUser.departmentIds && currentUser.departmentIds.length > 0)
      ? currentUser.departmentIds
      : (currentUser.departmentId ? [currentUser.departmentId] : []);
    
    if (currentUser.isSuperAdmin) {
      if (departmentId) {
        authorizedMongoDeptIds = [new mongoose.Types.ObjectId(departmentId.toString())];
      }
    } else if (currentUser.level === 1) { // Company Admin
      if (departmentId) {
        authorizedMongoDeptIds = [new mongoose.Types.ObjectId(departmentId.toString())];
      }
    // 🛡️ All other roles (Dept Admin, Sub Dept Admin, Operator) are scoped to their assigned departments
      authorizedMongoDeptIds = currentAssignedDeptIds.map((id: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(id.toString()));
    }

    const scopeFilter = authorizedMongoDeptIds.length > 0 
      ? { $or: [{ _id: { $in: authorizedMongoDeptIds } }, { parentDepartmentId: { $in: authorizedMongoDeptIds } }] }
      : {};

    const userScopeFilter = (currentUser.level !== undefined && currentUser.level >= 4)
      ? { _id: currentUser._id } // Operators only see themselves
      : authorizedMongoDeptIds.length > 0
        ? { $or: [{ departmentId: { $in: authorizedMongoDeptIds } }, { departmentIds: { $in: authorizedMongoDeptIds } }] }
        : {};

    // Fetch company to check for modules
    const targetCompanyId = currentUser.companyId || companyId;
    const company = targetCompanyId ? await mongoose.model('Company').findById(targetCompanyId) as any : null;
    const isHierarchicalEnabled = company?.enabledModules?.includes(Module.HIERARCHICAL_DEPARTMENTS);

    // Get time-based statistics (last 7 days, 30 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pendingSlaCutoff = new Date(Date.now() - SLA_CONFIG[GrievanceStatus.PENDING] * 60 * 60 * 1000);
    const assignedSlaCutoff = new Date(Date.now() - SLA_CONFIG[GrievanceStatus.ASSIGNED] * 60 * 60 * 1000);

    // Monthly trends (last 6 months) logic moved up for baseQuery reuse
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const normalizedCompanyId = targetCompanyId ? new mongoose.Types.ObjectId(targetCompanyId.toString()) : null;

    // 🚀 Performance Optimization: Single Parallel Block for ALL queries (approx 35+ metrics)
    const [
      totalGrievances,
      openGrievances,
      pendingGrievances,
      resolvedGrievances,
      assignedGrievancesCount,
      revertedGrievances,
      rejectedGrievances,
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
      deptCounts,
      // Integrated analytics queries
      avgResolutionTime,
      grievancesByPriority,
      appointmentsByDepartment,
      monthlyGrievances,
      monthlyAppointments,
      usersByRole,
      grievancesByDept,
      activeUsers,
    ] = await Promise.all([
      Grievance.countDocuments({ ...baseQuery }),
      Grievance.countDocuments({ ...baseQuery, status: { $in: [GrievanceStatus.PENDING, GrievanceStatus.ASSIGNED, GrievanceStatus.REVERTED] } }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.PENDING }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.RESOLVED }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.ASSIGNED }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.REVERTED }),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.REJECTED }),
      
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
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      
      Appointment.aggregate([
        { $match: { ...baseQuery, createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      
      Promise.all([
        Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.PENDING, createdAt: { $lt: pendingSlaCutoff } }),
        Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.ASSIGNED, $or: [{ assignedAt: { $exists: true, $lt: assignedSlaCutoff } }, { assignedAt: { $exists: false }, createdAt: { $lt: assignedSlaCutoff } }] })
      ]).then(([p, a]) => ({ totalOverdueCount: p + a, pendingOverdueCount: p, assignedOverdueCount: a })),

      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.ASSIGNED }),
      Department.countDocuments({ companyId: targetCompanyId, ...scopeFilter }),
      User.countDocuments({ companyId: targetCompanyId, ...userScopeFilter }),
      isHierarchicalEnabled ? Department.countDocuments({ companyId: targetCompanyId, ...scopeFilter, $or: [{ parentDepartmentId: null }, { parentDepartmentId: { $exists: false } }] }) : Promise.resolve(0),
      isHierarchicalEnabled ? Department.countDocuments({ companyId: targetCompanyId, ...scopeFilter, parentDepartmentId: { $ne: null } }) : Promise.resolve(0),
      Grievance.countDocuments({ ...baseQuery, status: GrievanceStatus.RESOLVED, resolvedAt: { $gte: new Date().setHours(0,0,0,0) } }),
      Grievance.countDocuments({ ...baseQuery, priority: 'HIGH', status: { $ne: GrievanceStatus.RESOLVED } }),
      Grievance.countDocuments({ ...baseQuery, priority: 'URGENT', status: { $ne: GrievanceStatus.RESOLVED } }),
      targetCompanyId ? User.aggregate([{ $match: { companyId: new mongoose.Types.ObjectId(targetCompanyId.toString()), ...userScopeFilter } }, { $unwind: { path: "$departmentIds", preserveNullAndEmptyArrays: true } }, { $group: { _id: { $ifNull: ["$departmentIds", "$departmentId"] }, count: { $sum: 1 } } }]) : Promise.resolve([]),

      // Integrated Aggregates
      Grievance.aggregate([{ $match: { ...baseQuery, status: GrievanceStatus.RESOLVED, resolvedAt: { $exists: true } } }, { $project: { resolutionTime: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 86400000] } } }, { $group: { _id: null, avgDays: { $avg: '$resolutionTime' } } }]),
      Grievance.aggregate([{ $match: { ...baseQuery } }, { $group: { _id: '$priority', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Appointment.aggregate([{ $match: { ...baseQuery } }, { $group: { _id: { $ifNull: ['$subDepartmentId', '$departmentId'] }, count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0] } } } }, { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } }, { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } }, { $project: { departmentId: '$_id', departmentName: '$department.name', count: 1, completed: 1 } }, { $sort: { count: -1 } }]),
      Grievance.aggregate([{ $match: { ...baseQuery, createdAt: { $gte: sixMonthsAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0] } } } }, { $sort: { _id: 1 } }]),
      Appointment.aggregate([{ $match: { ...baseQuery, createdAt: { $gte: sixMonthsAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0] } } } }, { $sort: { _id: 1 } }]),
      normalizedCompanyId ? User.aggregate([{ $match: { companyId: normalizedCompanyId, ...userScopeFilter } }, { $lookup: { from: 'roles', localField: 'customRoleId', foreignField: '_id', as: 'customRole' } }, { $unwind: { path: '$customRole', preserveNullAndEmptyArrays: true } }, { $group: { _id: { $ifNull: ['$customRole.name', 'Staff'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]) : Promise.resolve([]),
      Grievance.aggregate([{ $match: { ...baseQuery } }, { $group: { _id: { $ifNull: ['$subDepartmentId', '$departmentId'] }, total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.PENDING] }, 1, 0] } } } }, { $match: { _id: { $ne: null } } }, { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } }, { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } }, { $project: { departmentId: '$_id', departmentName: { $ifNull: ['$department.name', 'Unknown Department'] }, total: 1, pending: 1 } }]),
      normalizedCompanyId ? User.countDocuments({ companyId: normalizedCompanyId, ...userScopeFilter, isActive: true }) : Promise.resolve(0)
    ]);

    // Calculate rates
    const resolutionRate = totalGrievances > 0 ? ((resolvedGrievances / totalGrievances) * 100).toFixed(1) : '0';
    const completionRate = totalAppointments > 0 ? ((completedAppointments / totalAppointments) * 100).toFixed(1) : '0';
    const slaComplianceRate = totalGrievances > 0 ? (((totalGrievances - slaBreachedGrievances.totalOverdueCount) / totalGrievances) * 100).toFixed(1) : '100';

    // 🔒 SECURITY: Restrict appointments to Company Admin+
    const canSeeAppointments = currentUser.isSuperAdmin || currentUser.level === 1;

    res.json({
      success: true,
      data: {
        grievances: {
          total: openGrievances,
          registeredTotal: totalGrievances,
          pending: pendingGrievances,
          assigned: assignedGrievances,
          reverted: revertedGrievances,
          rejected: rejectedGrievances,
          inProgress: assignedGrievancesCount,
          resolved: resolvedGrievances,
          last7Days: grievancesLast7Days,
          last30Days: grievancesLast30Days,
          resolutionRate: parseFloat(resolutionRate),
          slaBreached: slaBreachedGrievances.totalOverdueCount,
          pendingOverdue: slaBreachedGrievances.pendingOverdueCount,
          slaComplianceRate: parseFloat(slaComplianceRate),
          avgResolutionDays: avgResolutionTime.length > 0 ? parseFloat(avgResolutionTime[0].avgDays.toFixed(1)) : 0,
          byPriority: grievancesByPriority.map(g => ({ priority: g._id || 'MEDIUM', count: g.count })),
          daily: dailyGrievances.map(d => ({ date: d._id, count: d.count })),
          monthly: monthlyGrievances.map(m => ({ month: m._id, count: m.count, resolved: m.resolved })),
          byDepartment: grievancesByDept.map(d => ({
            departmentId: d.departmentId,
            departmentName: d.departmentName || 'Unknown',
            total: d.total,
            pending: d.pending
          }))
        },
        appointments: canSeeAppointments ? {
          total: totalAppointments,
          pending: requestedAppointments + scheduledAppointments,
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
        } : {
          total: 0,
          pending: 0,
          requested: 0,
          scheduled: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          last7Days: 0,
          last30Days: 0,
          completionRate: 0,
          byDepartment: [],
          daily: [],
          monthly: []
        },
        departments: departmentCount,
        mainDepartments: mainDepartmentCount,
        subDepartments: subDepartmentCount,
        users: userCount,
        activeUsers,
        resolvedToday,
        highPriorityPending: highPriorityPending + urgentPriorityPending,
        isHierarchicalEnabled: !!isHierarchicalEnabled,
        deptCounts,
        usersByRole: usersByRole.reduce((acc: any[], current: any) => {
          const rawName = current._id || 'Unknown';
          const name = rawName.toString().replace(/_/g, ' ').toUpperCase();
          const existing = acc.find(a => a.name === name);
          if (existing) { existing.count += current.count; } else { acc.push({ name, count: current.count }); }
          return acc;
        }, []).sort((a: any, b: any) => b.count - a.count)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics', error: error.message });
  }
};

export const grievancesByDepartment = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.query;
    const matchQuery = await getAnalyticsBaseQuery(req, companyId);
    const distribution = await Grievance.aggregate([
      { $match: matchQuery },
      { $group: { _id: { $ifNull: ['$subDepartmentId', '$departmentId'] }, count: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.PENDING] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0] } } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $project: { departmentId: '$_id', departmentName: '$department.name', parentDepartmentId: '$department.parentDepartmentId', count: 1, pending: 1, resolved: 1 } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, data: distribution });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch department distribution', error: error.message });
  }
};

export const grievancesByStatus = async (req: Request, res: Response) => {
  try {
    const { companyId, departmentId } = req.query;
    const matchQuery = await getAnalyticsBaseQuery(req, companyId, departmentId);
    const distribution = await Grievance.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, data: distribution });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch status distribution', error: error.message });
  }
};

export const grievancesTrends = async (req: Request, res: Response) => {
  try {
    const { companyId, departmentId, days = 30 } = req.query;
    const matchQuery = await getAnalyticsBaseQuery(req, companyId, departmentId);
    matchQuery.createdAt = { $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) };
    const trends = await Grievance.aggregate([
      { $match: matchQuery },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, data: trends });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch grievance trends', error: error.message });
  }
};

export const appointmentsByDate = async (req: Request, res: Response) => {
  try {
    const { companyId, departmentId, days = 30 } = req.query;
    const baseQuery = await getAnalyticsBaseQuery(req, companyId, departmentId);
    const matchQuery: any = { ...baseQuery, appointmentDate: { $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000) } };
    const distribution = await Appointment.aggregate([
      { $match: matchQuery },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$appointmentDate' } }, count: { $sum: 1 }, scheduled: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.SCHEDULED] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, data: distribution });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch appointment distribution', error: error.message });
  }
};

export const performance = async (req: Request, res: Response) => {
  try {
    const { companyId, departmentId } = req.query;
    const baseQuery = await getAnalyticsBaseQuery(req, companyId, departmentId);
    const [topDepartments, topOperators] = await Promise.all([
      Grievance.aggregate([
        { $match: { ...baseQuery, departmentId: { $exists: true } } },
        { $group: { _id: '$departmentId', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0] } } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
        { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
        { $project: { departmentId: '$_id', departmentName: '$department.name', total: 1, resolved: 1, resolutionRate: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$resolved', '$total'] }, 100] }, 0] } } },
        { $sort: { resolutionRate: -1 } },
        { $limit: 10 }
      ]),
      Grievance.aggregate([
        { $match: { ...baseQuery, assignedTo: { $exists: true }, status: GrievanceStatus.RESOLVED } },
        { $group: { _id: '$assignedTo', resolved: { $sum: 1 }, avgResolutionDays: { $avg: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 86400000] } } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { operatorName: '$user.name', resolved: 1, avgResolutionDays: { $round: ['$avgResolutionDays', 1] } } },
        { $sort: { resolved: -1 } },
        { $limit: 10 }
      ])
    ]);
    res.json({ success: true, data: { topDepartments, topOperators } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch performance statistics', error: error.message });
  }
};

export const hourly = async (req: Request, res: Response) => {
  try {
    const { companyId, departmentId, days = 1 } = req.query;
    const matchQuery = await getAnalyticsBaseQuery(req, companyId, departmentId);
    const lookbackDays = Math.max(Number(days) || 1, 1);

    matchQuery.createdAt = {
      $gte: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
    };

    const distribution = await Grievance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$status', GrievanceStatus.PENDING] }, 1, 0]
            }
          },
          resolved: {
            $sum: {
              $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: distribution.map((entry) => ({
        hour: entry._id,
        count: entry.count,
        pending: entry.pending,
        resolved: entry.resolved
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch hourly analytics', error: error.message });
  }
};

export const category = async (req: Request, res: Response) => {
  try {
    const { companyId, departmentId } = req.query;
    const matchQuery = await getAnalyticsBaseQuery(req, companyId, departmentId);

    const distribution = await Grievance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $ifNull: ['$category', 'Uncategorized'] },
          count: { $sum: 1 },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$status', GrievanceStatus.PENDING] }, 1, 0]
            }
          },
          resolved: {
            $sum: {
              $cond: [{ $eq: ['$status', GrievanceStatus.RESOLVED] }, 1, 0]
            }
          }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]);

    res.json({
      success: true,
      data: distribution.map((entry) => ({
        category: entry._id,
        count: entry.count,
        pending: entry.pending,
        resolved: entry.resolved
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch category analytics', error: error.message });
  }
};
