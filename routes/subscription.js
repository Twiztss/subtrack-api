import { Router } from "express";
import authorize from "../middlewares/auth.middleware.js";
import { cancelSubscription, createSubscription, editSubscription, getRenewalSubscription, getSubscriptionDetail, getSubscriptions, getSubscriptionSummary, getUserSubscription, removeSubscription } from "../controllers/subscription.controller.js";
import { success } from "../utils/response.js";

const router = Router();

router.get('/', authorize, getSubscriptions);

router.get('/upcoming-renewals', authorize, getRenewalSubscription);

router.get('/filter', (req, res) => {
    success(res, {
        message: 'You can filter by the following fields:',
        data: {
            availableFilters: ['id', 'name', 'status', 'category', 'price', 'renewalDate'],
            example: 'user/:userid?name=netflix&status=active',
        },
    });
});

router.get('/:id', authorize, getSubscriptionDetail);

router.post('/', authorize, createSubscription);

router.get('/user/:id/summary', authorize, getSubscriptionSummary);

router.get('/user/:id', authorize, getUserSubscription);

router.put('/:id', authorize, editSubscription);
    
router.put('/:id/cancel', authorize, cancelSubscription);

router.delete('/:id/remove', authorize, removeSubscription);
    
export default router;