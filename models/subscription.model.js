import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    name : {
        type : String,
        required : [true, 'Subscription name is required!'],
        trim : true,
        minLength : 2,
        maxLength : 100,
    },
    price : {
        type : String,
        required : [true, 'Subscription price is required!'],
        trim : true,
        min : [0, 'Price must be greater than 0!'],
        maxLength : [100, 'Price must be cheaper than 100!'],
    },
    currency : {
        type : String,
        enum : ['USD','EUR','GBP','THB'],
        default : 'USD',
    },
    frequency : {
        type : String,
        enum : ['daily', 'weekly', 'monthly', 'yearly'],
    },
    category : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Category',
        required : true,
    },
    payment : {
        type : String,
        enum : ['active', 'cancelled', 'expired'],
        default : 'active',
    },
    startDate : {
        type : Date,
        required : true,
        validate : {
            validator : (val) => val < new Date(),
            message : 'Invalid start date!',
        }
    },
    renewalDate : {
        type : Date,
        validate : {
            validator : function (val) {
                return val > this.startDate;
            },
            message : 'Invalid start date!',
        }
    },
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true,
        index : true,
    },
}, { timestamps : true });

subscriptionSchema.pre('save', function (next) {
    if (!this.renewalDate) {
        const renewalPeriods = {
            daily: 1,
            weekly: 7,
            monthly: 30,
            yearly: 365,
        };

        const days = renewalPeriods[this.frequency];
        if (days) {
            this.renewalDate = new Date(this.startDate);
            this.renewalDate.setDate(this.renewalDate.getDate() + days);
        }
    }

    if (this.renewalDate < new Date()) {
        this.status = 'expired';
    }

    next();
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;