import { Router } from 'express';
import { editUser, getUser, getUsers, removeUser } from '../controllers/user.controller.js';
import authorize from '../middlewares/auth.middleware.js';
const router = Router();

// GET users listing (requires auth).
router.get('/', authorize, getUsers);

// GET user from specific id
router.get('/:id', authorize, getUser);

router.put('/:id/edit', authorize, editUser);

router.delete('/:id/remove', authorize, removeUser);

export default router;