import Subscription from "../models/subscription.model.js";
import { workflowClient } from "../config/upstash.js";
import { QSTASH_TOKEN, SERVER_URL } from "../config/env.js";
import dayjs from "dayjs";
import { sendReminderEmail } from "../utils/send-email.js";
import User from "../models/user.model.js";
import { createFilterQuery } from "../utils/filter.js";

export const createSubscription = async (req, res, next) => {
    try {
        const subscription = await Subscription.create({
            ...req.body,
            user : req.user._id,
        });
        
        // 1. Upstash workflow
        const { workflowRunId } = await workflowClient.trigger({
            token : QSTASH_TOKEN,
            url : `${SERVER_URL}/api/v1/workflow/subscription/reminder`,
            body : {
                subscriptionId : subscription.id,
            },
            headers : {
                'content-type' : 'application/json',
            },
            retries : 0,
        });

        // 2. Send a confirmation email
        try {
            await sendReminderEmail({
                to: req.user.email,
                userName : req.user.name,
                type: 'subscription-created',
                subscription,
                customLabel: `✅ Your subscription to ${subscription.name} is confirmed!`
            });
        } catch (emailError) {
            console.error("Failed to send subscription confirmation email:", emailError);
            // Do not block the main response, just log the error
        }

        // 3. Date Configuration
        const renewalDate = dayjs(subscription.renewalDate);
        const currentDate = dayjs();
        const reminderDate = renewalDate.subtract(3, 'day');
        const tobeRenewed = reminderDate.isAfter(currentDate)

        // 4. Response status and data
        res.status(201).json({
            success : true,
            data : { subscription, workflowRunId, reminderDate, tobeRenewed },
        });

    } catch (err) {
        next(err);
    }
};

export const getUserSubscription = async (req, res, next) => {
    try {
        
        const { page, limit, sort, ...filters } = req.query;

        if (req.user.id !== req.params.id) {
            const error = new Error('Incorrect user credential!');
            error.statusCode = 401;
            throw error;
        }
        
        let query = createFilterQuery(filters);
        query = {...query, user : req.params.id};

        const n_page = parseInt(page) || 1;
        const n_limit = parseInt(limit) || 10;
        const skip = (n_page - 1) * n_limit;

        const total = await Subscription.countDocuments(query);
        const subscriptions = await Subscription.find(query).skip(skip).limit(n_limit);
        
        if (!subscriptions) {
            const error = new Error('No subscription has been created yet!');
            error.statusCode = 404;
            throw error; 
        }

        res.status(200).json({
            success : true,
            total : total,
            page : n_page,
            limit : n_limit,
            totalPages : Math.ceil(total / n_limit),
            data : subscriptions
        });
    
    } catch (err) {
        next(err);
    }
};

export const getSubscriptionDetail = async (req, res, next) => {
    try {
        
        const subscriptionDetail = await Subscription.findById(req.params.id);

        if (!subscriptionDetail) {
            const error = new Error('No subscription with that id!');
            error.statusCode = 404;
            throw error; 
        }

        res.status(200).json({
            success : true,
            data : subscriptionDetail
        })

    } catch (err) {
        next(err);
    }
};

export const getSubscriptions = async (req, res, next) => {
     try {
        const { page, limit, sort, ...filters } = req.query;

        const query = createFilterQuery(filters);

        const n_page = parseInt(page) || 1;
        const n_limit = parseInt(limit) || 10;
        const skip = (n_page - 1) * n_limit;

        const total = await Subscription.countDocuments(query);
        const subscriptions = await Subscription.find(query).skip(skip).limit(n_limit);

        res.status(200).json({
            success : true,
            total : total,
            page : n_page,
            limit : n_limit,
            totalPages : Math.ceil(total / n_limit),
            data : subscriptions
        });

    } catch (err) {
       next(err);
    } 
}

export const cancelSubscription = async (req, res, next) => {
    try {

        const newSubscription = await Subscription.findByIdAndUpdate(
            req.params.id,
            { $set : { payment : 'expired'}},
            { new : true}
        );

        if (!newSubscription) {
            const error = new Error('No subscription with that id!');
            error.statusCode = 404;
            throw error; 
        }
        
        res.json({
            success : true,
            data : newSubscription,
        })


    } catch (err) {
        next(err);
    }
};

export const getRenewalSubscription = async (req, res, next) => {
    try {

        const subscriptions = await Subscription.find();

        if (!subscriptions) {
            const error = new Error('No subscription at all!');
            error.statusCode = 404;
            throw error; 
        }
        
        const toRenew = subscriptions.filter(subs => {
            const now = new Date();
            const renewal = subs.renewalDate;
            const diffInDays = (renewal - now) / (1000 * 60 * 60 * 24);
            return diffInDays <= 7;
        });

        res.status(200).json({
            success : true,
            data : toRenew,
        });

    } catch (err) {
        next(err);
    }
};

export const removeSubscription = async (req, res, next) => {
    try {

        const deleteResult = await Subscription.deleteOne({ _id : req.params.id });

        if (deleteResult.deletedCount === 1) {
            res.status(204).json({
            success : true,
            message : "The subscription has been deleted"
            })
        } else {
            const error = new Error('Subscription Not Found');
            error.statusCode = 404;
            throw error;
        }


    } catch (err) {
        next(err);
    }
}

export const getSubscriptionSummary = async (req, res, next) => {
    try {

    } catch (err) {
        next(err);
    }

    if (req.user.id !== req.params.id) {
            const error = new Error('Incorrect user credential!');
            error.statusCode = 401;
            throw error;
        }
        
    const userSubscription = await Subscription.find({ user : req.params.id });
    
    if (!userSubscription) {
        const error = new Error('No subscription has been created yet!');
        error.statusCode = 404;
        throw error; 
    }
    
    const numSubscription = userSubscription.length;
    const totalCost = userSubscription.reduce((prev, cur) => prev + Number(cur.price), 0);
    const maxCost = userSubscription.reduce((prev, cur) => {
        return Number(cur.price) > Number(prev.price) ? cur : prev
    });

    res.status(200).send({
        success :  true,
        data : { numSubscription, totalCost, maxCost }
    });
}