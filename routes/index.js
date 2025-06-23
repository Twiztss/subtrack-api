import { Router } from 'express';
const router = Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  const { method, url } = req;
  res.send(`This path gets the ${method} request from URL of ${url}.`);
});

export default router;
