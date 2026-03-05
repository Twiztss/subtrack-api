import aj from "../config/arcjet.js";
import { sendError } from "../utils/response.js";

        
const arcjetMiddleware = async (req, res, next) => {
    try {
        const decision = await aj.protect(req, { requested : 1 });
        if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) return sendError(res, 429, "Rate limit exceeded");
            if (decision.reason.isBot()) return sendError(res, 403, "Bot detected");
            return sendError(res, 403, "Access denied");

        }
        next();
    } catch (err) {
        console.log(`Arcjet Middleware Error : ${err}`);
        next(err);
    }
};

export default arcjetMiddleware;