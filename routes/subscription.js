import { Router } from "express";
import authorize from "../middlewares/auth.middleware.js";
import { cancelSubscription, createSubscription, getRenewalSubscription, getSubscriptionDetail, getSubscriptions, getSubscriptionSummary, getUserSubscription, removeSubscription } from "../controllers/subscription.controller.js";
const router = Router();

router.get('/', authorize, getSubscriptions);

router.get('/upcoming-renewals', authorize, getRenewalSubscription);

router.get('/filter', (req, res, next) => {
    res.status(200).json({
        message: 'You can filter by the following fields:',
        availableFilters: ['id', 'name', 'status', 'category', 'price', 'renewalDate'],
        example: 'user/:userid/filter?name=netflix&status=active' 
    })
});

router.get('/:id', authorize, getSubscriptionDetail);

router.post('/', authorize, createSubscription);

router.put('/:id', (req, res, next) => { res.send({
        title : 'UPDATE subscription',
        message : '',
        content : '',
}); });

router.get('/user/:id/summary', authorize, getSubscriptionSummary);

router.get('/user/:id', authorize, getUserSubscription);
    
router.put('/:id/cancel', authorize, cancelSubscription);

router.delete('/:id/remove', authorize, removeSubscription);
    
export default router;