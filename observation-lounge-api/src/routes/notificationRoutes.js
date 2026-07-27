import { Router } from "express";

import {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../controllers/notificationController.js";

const router = Router();

router.post("/", createNotification);
router.get("/", getNotifications);

router.get(
  "/unread-count",
  getUnreadNotificationCount
);

router.patch(
  "/read-all",
  markAllNotificationsAsRead
);

router.patch(
  "/:id/read",
  markNotificationAsRead
);

export default router;