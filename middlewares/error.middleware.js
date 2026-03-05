import mongoose from "mongoose";
import { sendError } from "../utils/response.js";

const errorHandler = (err, req, res, next) => {
  if (err instanceof mongoose.Error.CastError) {
    err.message = 'Resource not found';
  // Duplicate Key Error
    err.statusCode = 404;
  }

  if (err.code && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
  // Validation Error
    err.message = `Duplicate key error on field ${field}`;
    err.statusCode = 409;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map(e => e.message);
    err.message = `Validation error: ${errors.join(", ")}`;
    err.statusCode = 400;
  }

  if (!err.statusCode && (err instanceof mongoose.Error || err.name === 'MongoError')) {
    err.message = `Database error: ${err.message || 'Unknown'}`;
    err.statusCode = 500;
  }

  const statusCode = err.statusCode || 500;
  const extra = process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {};
  sendError(res, statusCode, err, extra);
};

export default errorHandler;
