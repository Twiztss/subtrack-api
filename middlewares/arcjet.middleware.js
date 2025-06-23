import aj from "../config/arcjet.js";

const arcjetMiddleware = async (req, res, next) => {
    try {
        const decision = await aj.protect(req, { requested : 1 });
        
        if (decision.isDenied()) {

            // Handle denied reason
            if (decision.reason.isRateLimit()) { return res.status(429).json({ error : 'Rate limi exceeded' }); }
            if (decision.reason.isBot()) { return res.status(403).json({ error : 'Bot detected' }); }

            return res.status(403).json({ message : 'Access denied' })
        };
        
        next();

    } catch (err) {
        console.log(`Arcjet Middleware Error : ${err}`);
        next(err);
    }
}

export default arcjetMiddleware;