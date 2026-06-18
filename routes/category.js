import { Router } from "express";
import { getCategories, createCategory, updateCategory, deleteCategory, getCategoryById } from "../controllers/category.controller.js";
import authorize from "../middlewares/auth.middleware.js";

const router = Router();

router.get('/', authorize, getCategories);
router.get('/:id', authorize, getCategoryById);
router.post('/', authorize, createCategory);
router.put('/:id', authorize, updateCategory);
router.delete('/:id', authorize, deleteCategory);

export default router;