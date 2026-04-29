import mongoose from 'mongoose';
import Notification, { NotificationEventType } from '../models/Notification';
import User from '../models/User';

const toObjectId = (id: any): mongoose.Types.ObjectId | null => {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
};

export async function notifyCompanyAdmins(options: {
  companyId: any;
  eventType: NotificationEventType;
  title: string;
  message: string;
  grievanceId?: string;
  grievanceObjectId?: any;
  meta?: Record<string, any>;
}) {
  const companyObjectId = toObjectId(options.companyId);
  if (!companyObjectId) return;

  const admins = await User.find({
    companyId: companyObjectId,
    isActive: true,
    $or: [{ level: { $lte: 1 } }, { role: 'COMPANY_ADMIN' }],
  })
    .select('_id')
    .lean();

  if (!admins.length) return;

  const grievanceObjectId = toObjectId(options.grievanceObjectId);

  await Notification.insertMany(
    admins.map((admin) => ({
      userId: admin._id,
      companyId: companyObjectId,
      grievanceId: options.grievanceId,
      grievanceObjectId: grievanceObjectId || undefined,
      eventType: options.eventType,
      title: options.title,
      message: options.message,
      meta: options.meta || {},
      isRead: false,
    })),
  );
}
