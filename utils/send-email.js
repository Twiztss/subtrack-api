import dayjs from "dayjs";
import { generateEmailTemplate, generateReminderSubject } from "./email-template.js";
import { accountEmail, transporter } from "../config/nodemailer.js";

export const sendReminderEmail = async ({ to, userName, type, subscription, customLabel }) => {
    if (!to || !type) { throw new Error('Missing required parameters.'); }

    // Calculate daysLeft
    const renewalDate = dayjs(subscription.renewalDate);
    const now = dayjs();
    const daysLeft = renewalDate.diff(now, 'day');

    // Provide default links (customize as needed)
    const accountSettingsLink = "https://yourapp.com/account/settings";
    const supportLink = "https://yourapp.com/support";

    const mailInfo = {
        userName : userName,
        subscriptionName : subscription.name,
        renewalDate : renewalDate.format('MMM D, YYYY'),
        planName : subscription.name,
        price : `${subscription.currency} ${subscription.price} (${subscription.currency})`,
        paymentStatus : subscription.payment,
        daysLeft,
        accountSettingsLink,
        supportLink,
        customLabel
    }

    const message = generateEmailTemplate(mailInfo);
    const subject = generateReminderSubject({ subscriptionName: subscription.name, daysLeft, customLabel });

    const emailOptions = {
        from : accountEmail,
        to : to,
        subject : subject,
        html : message,
    };

    transporter.sendMail(emailOptions, (err, info) => {
        if (err) { console.log(err, 'Error sending email'); }
        console.log('Email sent : ' + info.response)
    });
}