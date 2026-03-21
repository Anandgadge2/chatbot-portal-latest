import express from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { Permission } from '../config/constants';
import * as analyticsController from '../controllers/analytics.controller';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard', requirePermission(Permission.VIEW_ANALYTICS), analyticsController.dashboard);
router.get('/grievances/by-department', requirePermission(Permission.VIEW_ANALYTICS), analyticsController.grievancesByDepartment);
router.get('/grievances/by-status', requirePermission(Permission.VIEW_ANALYTICS), analyticsController.grievancesByStatus);
router.get('/grievances/trends', requirePermission(Permission.VIEW_ANALYTICS), analyticsController.grievancesTrends);
router.get('/appointments/by-date', requirePermission(Permission.VIEW_ANALYTICS), analyticsController.appointmentsByDate);
router.get('/performance', requirePermission(Permission.VIEW_ANALYTICS), analyticsController.performance);
router.get('/hourly', requirePermission(Permission.VIEW_ANALYTICS), analyticsController.hourly);
router.get('/category', requirePermission(Permission.VIEW_ANALYTICS), analyticsController.category);

export default router;
