import { config } from "dotenv";

config( {
    path : `.env.${process.env.NODE_ENV || 'development'}.local`,
} )

export const { 
    PORT, NODE_ENV, SERVER_URL, 
    DB_URI, 
    JWT_SECRET, JWT_EXPIRES_IN,
    ARCJET_KEY,
    QSTASH_URL, QSTASH_TOKEN, 
    QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY,
    EMAIL_SENDER, EMAIL_PASSWORD,
    ENABLE_ARCJET, ENABLE_WORKFLOW } = process.env;

// Fail fast during boot if required secrets are missing
const REQUIRED_VARS = ['DB_URI', 'JWT_SECRET'];
if (process.env.NODE_ENV !== 'test') {
    const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
    if (ENABLE_ARCJET === 'true' && !ARCJET_KEY) {
        missing.push('ARCJET_KEY');
    }
    if (missing.length > 0) {
        console.error(`[env] Missing required environment variable(s): ${missing.join(', ')}`);
        process.exit(1);
    }
}