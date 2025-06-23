import mongoose, { model } from "mongoose";

// Create Schema object for storing user data in JSON
const userSchema = new mongoose.Schema({
   name : {
    type : String,
    required : [true, 'Username is required!'], // handles if the parameter is required
    trim : true,                                // trims the whitespace
    minLength : 2,
    maxLength : 50,
   },
   email : {
    type : String,
    required : [true, 'Username Email is required!'],
    unique : true,
    trim : true,
    lowercase : true,
    minLength : 5,
    maxLength : 255,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please fill a valid email address!'],
   },
   password : {
    type : String,
    required : [true, 'User password is required!'],
    minLength : 6, 
   },
}, { timestamps : true } );

const User = mongoose.model('User', userSchema);

export default User;