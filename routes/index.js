import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

router.get('/', (req, res) => {
  success(res, {
    message: 'Subscription Tracker API',
    data: { method: req.method, path: req.path },
  });
});

export default router;
