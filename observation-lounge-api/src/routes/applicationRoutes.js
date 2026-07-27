import { Router } from "express";

import {
  checkApplicationHealth,
  createApplication,
  deleteApplication,
  getApplicationById,
  getApplications,
  updateApplication,
} from "../controllers/applicationController.js";

const router = Router();
router.post("/", createApplication);
router.get("/", getApplications);

router.post("/:id/check", checkApplicationHealth);
router.get("/:id", getApplicationById);

router.patch("/:id", updateApplication);
router.delete("/:id", deleteApplication);


export default router;