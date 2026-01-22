import { Router } from "express";
import { sendReminders } from "../controllers/workflow.controller.js";
import { verifyQStashSignature } from "../middlewares/qstash.middleware.js";

const router = Router();

// Apply QStash signature verification to workflow endpoints
router.post('/subscription/reminder', verifyQStashSignature, sendReminders);

export default router;