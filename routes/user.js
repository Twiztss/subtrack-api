import { Router } from 'express';
import { editUser, getUser, getUsers, removeUser } from '../controllers/user.controller.js';
import authorize from '../middlewares/auth.middleware.js';
const router = Router();

// GET users listing.
router.get('/', getUsers);

// GET user from specific id
router.get('/:id', authorize, getUser);

router.put('/:id/edit', authorize, editUser);

router.delete('/:id/remove', removeUser);

export default router;