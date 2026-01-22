import { Receiver } from "@upstash/qstash";
import { QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY } from "../config/env.js";

// Initialize the QStash receiver for signature verification
const receiver = new Receiver({
    currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
});

/**
 * Middleware to verify QStash request signatures
 * This ensures that requests to workflow endpoints are coming from QStash
 */
export const verifyQStashSignature = async (req, res, next) => {
    try {
        const signature = req.headers["upstash-signature"];
        
        if (!signature) {
            console.error("Missing QStash signature in request headers");
            return res.status(401).json({ 
                success: false, 
                error: "Unauthorized: Missing QStash signature" 
            });
        }

        // Get the raw body as string for verification
        const body = JSON.stringify(req.body);
        
        // Verify the signature
        const isValid = await receiver.verify({
            signature,
            body,
        });

        if (!isValid) {
            console.error("Invalid QStash signature");
            return res.status(401).json({ 
                success: false, 
                error: "Unauthorized: Invalid QStash signature" 
            });
        }

        // Signature is valid, continue to the next middleware/handler
        next();
    } catch (error) {
        console.error("Error verifying QStash signature:", error);
        return res.status(500).json({ 
            success: false, 
            error: "Internal server error during signature verification" 
        });
    }
};
