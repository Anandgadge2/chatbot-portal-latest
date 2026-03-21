import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import * as companyController from '../controllers/company.controller';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/companies
// @desc    Get all companies (SuperAdmin only)
// @access  Private/SuperAdmin
router.get('/', requireSuperAdmin, companyController.list);

// @route   POST /api/companies
// @desc    Create new company with admin (SuperAdmin only)
// @access  Private/SuperAdmin
router.post('/', requireSuperAdmin, companyController.create);

// @route   GET /api/companies/me
// @desc    Get current user's company (for CompanyAdmin)
// @access  Private/CompanyAdmin
router.get('/me', authenticate, companyController.me);

// @route   GET /api/companies/:id
// @desc    Get company by ID
// @access  Private/SuperAdmin
router.get('/:id', requireSuperAdmin, companyController.getById);

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private/SuperAdmin
router.put('/:id', requireSuperAdmin, companyController.update);

// @route   DELETE /api/companies/:id
// @desc    Soft delete company
// @access  Private/SuperAdmin
router.delete('/:id', requireSuperAdmin, companyController.remove);

export default router;
