import express, { Request, Response } from 'express';
import Notification from '../models/Notification';
import { authenticate } from '../middleware/auth';
import { requireDatabaseConnection } from '../middleware/dbConnection';

const router = express.Router();

router.use(requireDatabaseConnection);
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);

    const query: any = { userId: currentUser._id };
    if (req.query.isRead === 'true') query.isRead = true;
    if (req.query.isRead === 'false') query.isRead = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);

    return res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
  }
});

router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const unreadCount = await Notification.countDocuments({ userId: currentUser._id, isRead: false });
    return res.json({ success: true, data: { unreadCount } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: error.message });
  }
});

router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: currentUser._id },
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({ success: true, data: { notification } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read', error: error.message });
  }
});

router.put('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const result = await Notification.updateMany(
      { userId: currentUser._id, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    return res.json({ success: true, data: { updatedCount: result.modifiedCount } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to mark all notifications as read', error: error.message });
  }
});

export default router;
