import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { serve } = require("@upstash/workflow/express");
import Subscription from "../models/subscription.model.js";
import dayjs from "dayjs";
import { sendReminderEmail } from '../utils/send-email.js';

const REMINDERS = [7, 5, 3, 1];

export const sendReminders = serve(async (context) => {
    await context.sleep("initial-delay", "2s");
    const { subscriptionId } = context.requestPayload; // Pass ID to workflow
    const subscription = await fetchSubscription(context, subscriptionId);

    if (!subscription || subscription.status !== 'active') {
        return;
    }

    const renewalDate = dayjs(subscription.renewalDate);
    const currentDate = dayjs();

    if (renewalDate.isBefore(currentDate)) {
        console.log(`Renewal date has passed for subscription ${subscriptionId}. Stopping workflow.`);
        return;
    }

    for (let days of REMINDERS) {
        const reminderDate = renewalDate.subtract(days, 'day');
    
        console.log(`[Workflow Debug] Checking for ${days} days before. Reminder date: ${reminderDate.toISOString()}. Is it in the future? ${reminderDate.isAfter(currentDate)}`);

        if (reminderDate.isAfter(currentDate)) {
            // Future reminder: sleep until the correct time, then trigger
            await sleepUntilReminder(context, `Reminder ${days} days before`, reminderDate);
            await triggerReminder(context, `${days} days before reminder`, subscription, days);
        } else {
            // Missed reminder: trigger immediately
            await triggerReminder(context, `${days} days before reminder (late)`, subscription, days);
        }
    }
});

const fetchSubscription = async (context, subscriptionId) => {
    return await context.run('get subscription', async () => {
        return Subscription.findById(subscriptionId).populate('user', 'name email');
    });
};

const sleepUntilReminder = async (context, label, date) => {
    console.log(`Sleeping until ${label} reminder at ${date}`);
    await context.sleepUntil(label, date.toDate());
};

const triggerReminder = async (context, label, subscription, days) => {
    return await context.run(label, async () => {
        console.log(`Triggering ${label} reminder`);
        // Send email with dynamic daysLeft and label
        await sendReminderEmail({
            to: subscription.user.email,
            userName : 'User',
            type: label,
            subscription,
            customLabel: label.includes('late') ? `${days} days before reminder (late)` : undefined,
        });
    });
};