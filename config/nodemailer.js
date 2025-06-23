import nodemailer from "nodemailer";
import { EMAIL_PASSWORD, EMAIL_SENDER } from "./env.js";

export const accountEmail = EMAIL_SENDER

export const transporter = nodemailer.createTransport({
    service : 'gmail',
    auth : {
        user : EMAIL_SENDER,
        pass :  EMAIL_PASSWORD
    }
})