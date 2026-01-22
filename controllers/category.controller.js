import Category from "../models/category.model.js";
import Subscription from "../models/subscription.model.js";
import { createFilterQuery, createSortQuery } from "../utils/filter.js";

export const getCategories = async (req, res, next) => {
    try {
        const { page, limit, sort, ...filters } = req.query;

        const query = createFilterQuery(filters);

        const n_page = parseInt(page) || 1;
        const n_limit = parseInt(limit) || 10;
        const skip = (n_page - 1) * n_limit;

        const total = await Category.countDocuments(query);
        const categories = await Category.find(query)
            .sort(createSortQuery(sort))
            .skip(skip)
            .limit(n_limit);
        res.status(200).json({
            success : true,
            total : total,
            page : n_page,
            limit : n_limit,
            totalPages : Math.ceil(total / n_limit),
            data : categories,
        });
    } catch (err) {
        next(err);
    }
}

export const createCategory = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            const error = new Error('Category name is required');
            error.statusCode = 400;
            throw error;
        }

        const existingCategory = await Category.findOne({ name : name.toLowerCase().trim() });

        if (existingCategory) {
            const error = new Error('Category already exists');
            error.statusCode = 409;
            throw error;
        }

        const newCategory = await Category.create({ name });

        res.status(201).json({ success : true, data : newCategory });

    } catch (err) { next(err); }
}

export const getCategoryById = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Get subscription count for this category
        const subscriptionCount = await Subscription.countDocuments({ 
            category: category
        });

        res.status(200).json({ 
            success : true, 
            data : {
                ...category.toObject(),
                subscriptionCount
            }
        });
    } catch (err) { next(err); }
}

export const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        // Validate input
        if (!name || !name.trim()) {
            const error = new Error('Category name is required');
            error.statusCode = 400;
            throw error;
        }

        const category = await Category.findById(id);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if new name already exists (excluding current category)
        const existingCategory = await Category.findOne({ 
            name: name.toLowerCase().trim(),
            _id: { $ne: id }
        });

        if (existingCategory) {
            const error = new Error('Category name already exists');
            error.statusCode = 409;
            throw error;
        }

        category.name = name;
        const updatedCategory = await category.save();
        
        res.status(200).json({ success : true, data : updatedCategory });
    } catch (err) { next(err); }
}

export const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Check if category exists
        const category = await Category.findById(id);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if category is being used by any subscriptions
        const subscriptionCount = await Subscription.countDocuments({ 
            categories: id 
        });

        if (subscriptionCount > 0) {
            const error = new Error(`Cannot delete category. It is used by ${subscriptionCount} subscription(s)`);
            error.statusCode = 409;
            throw error;
        }

        const deletedCategory = await Category.findByIdAndDelete(id);
        
        res.status(200).json({ 
            success : true, 
            message: 'Category deleted successfully',
            data : deletedCategory 
        });
    } catch (err) { next(err); }
}