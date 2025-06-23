import { Router } from 'express';
import { getUser, getUsers } from '../controllers/user.controller.js';
import authorize from '../middlewares/auth.middleware.js';
const router = Router();

// GET users listing.
router.get('/', getUsers);

// GET user from specific id
router.get('/:id', authorize, getUser);

router.put('/:id', function(req, res, next) {
  res.send({
        title : 'PUT user',
        message : '',
        content : '',
    });
});

router.delete('/:id', function(req, res, next) {
  res.send({
        title : 'DELETE user',
        message : '',
        content : '',
    });
});

export default router;