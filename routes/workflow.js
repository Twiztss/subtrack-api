import { Router } from "express";
import { sendReminders } from "../controllers/workflow.controller.js";

const router = Router();

router.post('/subscription/reminder', sendReminders);

export default router;