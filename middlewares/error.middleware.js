import mongoose from "mongoose";

const errorHandler = (err, req, res, next) => {
  
  // Cast Error
  if (err instanceof mongoose.Error.CastError ) {
    err.message = 'Resource not found';
    err.statusCode = 404;
  }

  // Duplicate Key Error
  if (err.code && err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    err.message = `Duplicate key error on field ${field}`;
    err.statusCode = 409;
  }

  // Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map(e => e.message);
    err.message = `Validation error, detail : ${errors.join(", ")}`;
    err.statusCode(400);
  }

  if (err instanceof mongoose.Error || err.name === 'MongoError') {
    const message = err.message;
    err.message = `Database Error, detail : ${message}`;
    err.statusCode = 500;
    };

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });

}

export default errorHandler;