import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name : {
        type : String,
        required : [true, 'Category name is required!'],
        unique : true,
        trim : true,
        lowercase : true,
        minLength : 2,
        maxLength : 100,
    },
}, { timestamps : true });

const Category = mongoose.model('Category', categorySchema);

export default Category;