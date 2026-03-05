import mongoose from "mongoose";
import User from "../models/user.model.js";
import jwt from 'jsonwebtoken';
import bcrypt from "bcryptjs";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";
import { success } from "../utils/response.js";

export const signUp = async (req, res, next) => {
    // Sign Up Logic
    const session = await mongoose.startSession();      // Start mongoose sessions (atomic operation)
    session.startTransaction();

    try {
        const  { name, email, password } = req.body;

        // Guard: ensure all required fields are present before any async work.
        // Without this, bcrypt.hash(undefined) throws a TypeError (→ 500) and
        // User.findOne({ email: undefined }) strips the key, returning the first
        // document in the collection and triggering a false 409.
        if (!name || !email || !password) {
            const error = new Error('Name, email, and password are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            const error = new Error('User already exist');
            error.statusCode = 409;
            throw error;
        }

        if (password.length < 6) {
            const error = new Error('Password must be at least 6 characters long');
            error.statusCode = 400;
            throw error;
        }

        // Password hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user (document) on database
        const newUsers = await User.create([{ name, email, password : hashedPassword}], { runValidators: true, session });
        const token = jwt.sign({ userId : newUsers[0].id }, JWT_SECRET, { expiresIn : JWT_EXPIRES_IN });

        await session.commitTransaction();
        session.endSession();

        // Exclude the hashed password from the response payload.
        // newUsers[0] is a Mongoose document; toObject() gives a plain JS object
        // so we can safely destructure the password out before sending.
        const { password: _pw, ...userWithoutPassword } = newUsers[0].toObject();

        success(res, {
            statusCode: 201,
            message: 'User created successfully',
            data: { token, user: userWithoutPassword },
        });

     } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
     }
}

export const signIn = async (req, res, next) => {
    // Sign In Logic
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            const error = new Error('Invalid password');
            error.statusCode = 401;
            throw error;
        }

        const token = jwt.sign({ userId : user._id }, JWT_SECRET, { expiresIn : JWT_EXPIRES_IN });
        success(res, {
            message: 'User signed in successfully',
            data: { token, user },
        });

        await session.commitTransaction();
        session.endSession();

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
}

export const signOut = async (req, res, next) => {
    success(res, { message: 'Signed out successfully' });
}