import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import User from '../models/user.model.js';
import { sendError } from '../utils/response.js';

const authorize = async (req, res, next) => {
    try {
        let token;

        // Get token from authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) { 
            const error = new Error('Unauthorized');
            error.statusCode = 401;
            throw error;
        }

        
        // Decode JWT token
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId);
        
        if (!user) { 
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        req.user = user;
        next();

    } catch (err) {
        sendError(res, err.statusCode || 401, err);
        next(err);
    }
};

export default authorize;