import mongoose from "mongoose";
import Subscription from "../models/subscription.model.js";
import { workflowClient } from "../config/upstash.js";
import { QSTASH_TOKEN, SERVER_URL, ENABLE_WORKFLOW } from "../config/env.js";
import dayjs from "dayjs";
import { sendReminderEmail } from "../utils/send-email.js";
import { createFilterQuery } from "../utils/filter.js";
import { parsePagination } from "../utils/pagination.js";
import { createSortQuery } from "../utils/filter.js";
import Category from "../models/category.model.js";
import { success } from "../utils/response.js";
import { convertCurrency, SUBSCRIPTION_CURRENCIES } from "../utils/currency.js";

export const createSubscription = async (req, res, next) => {
    try {

        const category_name = String(req.body.category || '').toLowerCase().trim();
        if (!category_name) {
            const error = new Error('Category is required');
            error.statusCode = 400;
            throw error;
        }
        let category = await Category.findOne({ name : category_name });
        if (!category) {
            category = await Category.create({ name : category_name });
        }
        
        const { name, price, currency, frequency, payment, startDate, renewalDate: inputRenewalDate } = req.body;
        const subscription = await Subscription.create({
            name,
            price,
            currency,
            frequency,
            payment,
            startDate,
            renewalDate: inputRenewalDate,
            user : req.user._id,
            category,
        });
        
        // 1. Upstash workflow (conditionally triggered)
        let workflowRunId = null;
        const isWorkflowEnabled = ENABLE_WORKFLOW === 'true';
        
        if (isWorkflowEnabled) {
            try {
                const result = await workflowClient.trigger({
                    url : `${SERVER_URL}/api/v1/workflow/subscription/reminder`,
                    body : {
                        subscriptionId : subscription.id,
                    },
                    retries : 0,
                });
                workflowRunId = result.workflowRunId;
                console.log(`✅ Workflow triggered successfully: ${workflowRunId}`);
            } catch (workflowError) {
                console.error("⚠️ Failed to trigger workflow:", workflowError.message);
                // Don't block subscription creation if workflow fails
            }
        } else {
            console.log(`ℹ️ Workflow disabled - subscription created without automated reminders`);
        }

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

        success(res, {
            statusCode: 201,
            data: {
                subscription,
                workflowRunId,
                reminderDate,
                tobeRenewed,
                workflowEnabled: isWorkflowEnabled,
            },
        });

    } catch (err) {
        next(err);
    }
};

export const getUserSubscription = async (req, res, next) => {
    try {
        if (req.user.id !== req.params.id) {
            const error = new Error('Incorrect user credential!');
            error.statusCode = 403;
            throw error;
        }

        const { page, limit, sort, ...filters } = req.query;
        const query = { ...createFilterQuery(filters), user: req.params.id };
        const { n_page, n_limit, skip } = parsePagination({ page, limit });

        const total = await Subscription.countDocuments(query);
        const subscriptions = await Subscription.find(query)
            .sort(createSortQuery(sort))
            .skip(skip)
            .limit(n_limit);

        success(res, {
            data: subscriptions,
            meta: { total, page: n_page, limit: n_limit, totalPages: Math.ceil(total / n_limit) },
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

        if (subscriptionDetail.user.toString() !== req.user.id) {
            const error = new Error('Unauthorized: cannot access another user\'s subscription');
            error.statusCode = 403;
            throw error;
        }

        success(res, { data: subscriptionDetail });
    } catch (err) {
        next(err);
    }
};

export const getSubscriptions = async (req, res, next) => {
    try {
        const { page, limit, sort, ...filters } = req.query;
        const query = { ...createFilterQuery(filters), user: req.user._id };
        const { n_page, n_limit, skip } = parsePagination({ page, limit });

        const total = await Subscription.countDocuments(query);
        const subscriptions = await Subscription.find(query)
            .sort(createSortQuery(sort))
            .skip(skip)
            .limit(n_limit);

        success(res, {
            data: subscriptions,
            meta: { total, page: n_page, limit: n_limit, totalPages: Math.ceil(total / n_limit) },
        });
    } catch (err) {
        next(err);
    }
}

export const cancelSubscription = async (req, res, next) => {
    try {

        const subscription = await Subscription.findById(req.params.id);

        if (!subscription) {
            const error = new Error('No subscription with that id!');
            error.statusCode = 404;
            throw error; 
        }

        if (subscription.user.toString() !== req.user.id) {
            const error = new Error('Unauthorized: cannot cancel another user\'s subscription');
            error.statusCode = 403;
            throw error;
        }

        subscription.payment = 'cancelled';
        const newSubscription = await subscription.save();
        
        success(res, { data: newSubscription });
    } catch (err) {
        next(err);
    }
};

export const getRenewalSubscription = async (req, res, next) => {
    try {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const toRenew = await Subscription.find({
            user: req.user._id,
            renewalDate: { $gte: now, $lte: sevenDaysFromNow },
        });

        success(res, { data: toRenew });
    } catch (err) {
        next(err);
    }
};

export const removeSubscription = async (req, res, next) => {
    try {

        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) {
            const error = new Error('Subscription Not Found');
            error.statusCode = 404;
            throw error;
        }

        if (subscription.user.toString() !== req.user.id) {
            const error = new Error('Unauthorized: cannot delete another user\'s subscription');
            error.statusCode = 403;
            throw error;
        }

        await subscription.deleteOne();
        success(res, { message: 'The subscription has been deleted' });

    } catch (err) {
        next(err);
    }
}

export const getSubscriptionSummary = async (req, res, next) => {
    try {
        if (req.user.id !== req.params.id) {
            const error = new Error('Incorrect user credential!');
            error.statusCode = 403;
            throw error;
        }

        const userId = new mongoose.Types.ObjectId(req.params.id);

        const [result] = await Subscription.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    numSubscription: { $sum: 1 },
                    totalCost: { $sum: { $toDouble: '$price' } },
                    maxCostDoc: {
                        $max: {
                            $mergeObjects: [
                                { price: { $toDouble: '$price' } },
                                '$$ROOT',
                            ],
                        },
                    },
                },
            },
        ]);

        if (!result) {
            success(res, { data: { numSubscription: 0, totalCost: 0, maxCost: null } });
            return;
        }

        success(res, {
            data: {
                numSubscription: result.numSubscription,
                totalCost: parseFloat(result.totalCost.toFixed(2)),
                maxCost: result.maxCostDoc,
            },
        });
    } catch (err) {
        next(err);
    }
}

export const getSubscriptionAnalytics = async (req, res, next) => {
    try {
        if (req.user.id !== req.params.id) {
            const error = new Error('Incorrect user credential!');
            error.statusCode = 401;
            throw error;
        }

        const userId = new mongoose.Types.ObjectId(req.params.id);

        const result = await Subscription.aggregate([
            {
                $match: {
                    user: userId,
                    payment: 'active',
                },
            },
            {
                $addFields: {
                    priceAsDouble: { $toDouble: '$price' },
                    monthlyPrice: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: ['$frequency', 'daily'] },
                                    then: { $multiply: [{ $toDouble: '$price' }, 30] },
                                },
                                {
                                    case: { $eq: ['$frequency', 'weekly'] },
                                    then: { $multiply: [{ $toDouble: '$price' }, { $divide: [52, 12] }] },
                                },
                                {
                                    case: { $eq: ['$frequency', 'monthly'] },
                                    then: { $toDouble: '$price' },
                                },
                                {
                                    case: { $eq: ['$frequency', 'yearly'] },
                                    then: { $divide: [{ $toDouble: '$price' }, 12] },
                                },
                            ],
                            default: { $toDouble: '$price' },
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryInfo',
                },
            },
            {
                $unwind: '$categoryInfo',
            },
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                monthlyBurnRate: { $sum: '$monthlyPrice' },
                                activeSubscriptionCount: { $sum: 1 },
                            },
                        },
                    ],
                    categoryBreakdown: [
                        {
                            $group: {
                                _id: '$categoryInfo.name',
                                monthlyBurnRate: { $sum: '$monthlyPrice' },
                                subscriptionCount: { $sum: 1 },
                            },
                        },
                        { $sort: { monthlyBurnRate: -1 } },
                    ],
                },
            },
        ]);

        const totals = result[0]?.totals[0] ?? { monthlyBurnRate: 0, activeSubscriptionCount: 0 };
        const monthlyBurnRate = parseFloat(totals.monthlyBurnRate.toFixed(2));
        const yearlyBurnRate = parseFloat((monthlyBurnRate * 12).toFixed(2));
        const activeSubscriptionCount = totals.activeSubscriptionCount;

        const categoryBreakdown = (result[0]?.categoryBreakdown ?? []).map((cat) => {
            const catMonthly = parseFloat(cat.monthlyBurnRate.toFixed(2));
            const catYearly = parseFloat((catMonthly * 12).toFixed(2));
            const percentage = monthlyBurnRate > 0
                ? parseFloat(((catMonthly / monthlyBurnRate) * 100).toFixed(2))
                : 0;
            return {
                category: cat._id,
                monthlyBurnRate: catMonthly,
                yearlyBurnRate: catYearly,
                subscriptionCount: cat.subscriptionCount,
                percentage,
            };
        });

        success(res, {
            data: {
                monthlyBurnRate,
                yearlyBurnRate,
                activeSubscriptionCount,
                categoryBreakdown,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const editSubscription = async (req, res, next) => {
    try {

        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) {
            const error = new Error('No subscription with that id!');
            error.statusCode = 404;
            throw error; 
        }

        if (subscription.user.toString() !== req.user.id) {
            const error = new Error('Unauthorized: cannot edit another user\'s subscription');
            error.statusCode = 403;
            throw error;
        }

        const ALLOWED_FIELDS = ['name', 'price', 'currency', 'frequency', 'category', 'payment', 'startDate', 'renewalDate'];
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

        const updatedSubscription = await Subscription.findByIdAndUpdate(
            req.params.id,
            { $set : updateFields },
            { new : true, runValidators: true }
        );
        
        success(res, { statusCode: 200, data: updatedSubscription });
    } catch (err) {
        next(err);
    }
}

export const updateSubscriptionCurrency = async (req, res, next) => {
    try {
        const targetCurrency = req.body?.currency;
        if (targetCurrency == null || String(targetCurrency).trim() === '') {
            const error = new Error('Target currency is required');
            error.statusCode = 400;
            throw error;
        }
        if (!SUBSCRIPTION_CURRENCIES.includes(targetCurrency)) {
            const error = new Error(
                `Currency must be one of: ${SUBSCRIPTION_CURRENCIES.join(', ')}`
            );
            error.statusCode = 400;
            throw error;
        }

        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) {
            const error = new Error('No subscription with that id!');
            error.statusCode = 404;
            throw error;
        }
        if (subscription.user.toString() !== req.user.id) {
            const error = new Error('Incorrect user credential!');
            error.statusCode = 401;
            throw error;
        }

        const fromCurrency = subscription.currency || 'USD';
        const numericPrice = Number.parseFloat(String(subscription.price).trim());
        if (!Number.isFinite(numericPrice)) {
            const error = new Error('Subscription price is not a valid number');
            error.statusCode = 400;
            throw error;
        }

        const converted = await convertCurrency(
            numericPrice,
            fromCurrency,
            targetCurrency
        );
        const priceString = converted.toFixed(2);

        const updatedSubscription = await Subscription.findByIdAndUpdate(
            req.params.id,
            { $set : { currency : targetCurrency, price : priceString } },
            { new : true, runValidators : true }
        );

        success(res, { statusCode: 200, data: updatedSubscription });
    } catch (err) {
        next(err);
    }
}