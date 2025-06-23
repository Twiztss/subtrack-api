import mongoose from "mongoose";
import User from "../models/user.model.js";
import jwt from 'jsonwebtoken';
import bcrypt from "bcryptjs";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";

export const signUp = async (req, res, next) => {
    // Sign Up Logic
    const session = await mongoose.startSession();      // Start mongoose sessions (atomic operation)
    session.startTransaction();

    try {
        const  { name, email, password } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            const error = new Error('User already exist');
            error.statusCode = 409;
            throw error;
        }

        // Password hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user (document) on database
        const newUsers = await User.create([{ name, email, password : hashedPassword}], { session });
        const token = jwt.sign({ userId : newUsers[0].id }, JWT_SECRET, { expiresIn : JWT_EXPIRES_IN });

        await session.commitTransaction();
        session.endSession();
        
        res.status(201).json({
            success : true,
            message : 'User created successfully',
            data : {
                token,
                user : newUsers[0],
            }
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
        res.status(200).json({
            success : true,
            message : 'User signed in successfully',
            data : {
                token,
                user,
            }
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
    // Sign Out Logic
    res.status(200).send({
        title : 'sign-in',
        message : '',
        content : '',
    });
}