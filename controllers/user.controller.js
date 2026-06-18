import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { success } from "../utils/response.js";

export const getUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password');
        success(res, { data: users });
        
    } catch (err) {
        next(err);
    }
};

export const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        success(res, { data: user });

    } catch (err) {
        next(err);
    }
};

export const editUser = async (req, res, next) => {
    try {
        if (req.user.id !== req.params.id) {
            const error = new Error('Unauthorized: cannot edit another user');
            error.statusCode = 403;
            throw error;
        }

        const ALLOWED_FIELDS = ['name', 'email', 'password'];
        let updateFields = {};

        for (const key of ALLOWED_FIELDS) {
            if (req.body[key] !== undefined) {
                updateFields[key] = req.body[key];
            }
        }

        if (Object.keys(updateFields).length === 0) {
            const error = new Error('No valid fields provided for the edit.');
            error.statusCode = 400;
            throw error; 
        }

        if (updateFields.password) {
            const user = await User.findById(req.params.id).select('+password');
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            const isDuplicate = await bcrypt.compare(updateFields.password, user.password);
            if (isDuplicate) {
                const error = new Error('Password must not be the same as the current password.');
                error.statusCode = 400;
                throw error;
            }

            const salt = await bcrypt.genSalt(10);
            updateFields.password = await bcrypt.hash(updateFields.password, salt);
        }

        // runValidators: true ensures schema constraints (minLength, maxLength, etc.)
        // are enforced for update operations, which Mongoose skips by default.
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set : updateFields},
            { new : true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
    
        success(res, { data: updatedUser });

    } catch (err) {
        next(err);
    }
};

export const removeUser = async (req, res, next) => {
    try {
        if (req.user.id !== req.params.id) {
            const error = new Error('Unauthorized: cannot delete another user');
            error.statusCode = 403;
            throw error;
        }

        const deleteResult = await User.deleteOne({ _id : req.params.id });

        if (deleteResult.deletedCount === 1) {
            success(res, { message: 'The user has been deleted' });
        } else {
            const error = new Error('User Not Found');
            error.statusCode = 404;
            throw error;
        }

    } catch (err) {
        next(err);
    }
};