import nodemailer from "nodemailer";
import { EMAIL_PASSWORD, EMAIL_SENDER, NODE_ENV } from "./env.js";

export const accountEmail = EMAIL_SENDER

export const transporter = NODE_ENV === 'test' ? nodemailer.createTransport({
    jsonTransport : true,
}) : nodemailer.createTransport({
    service : 'gmail',
    auth : {
        user : EMAIL_SENDER,
        pass :  EMAIL_PASSWORD
    }
})
