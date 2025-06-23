import { Router } from "express";
import authorize from "../middlewares/auth.middleware.js";
import { cancelSubscription, createSubscription, getRenewalSubscription, getSubscriptionDetail, getSubscriptions, getUserSubscription } from "../controllers/subscription.controller.js";
const router = Router();

router.get('/', authorize, getSubscriptions);

router.get('/upcoming-renewals', authorize, getRenewalSubscription);

router.get('/:id', authorize, getSubscriptionDetail);

router.post('/', authorize, createSubscription);

router.put('/:id', (req, res, next) => { res.send({
        title : 'PUT subscription',
        message : '',
        content : '',
    }); });

router.delete('/:id', (req, res, next) => { res.send({
        title : 'DELETE subscription',
        message : '',
        content : '',
    }); });

router.get('/user/:id', authorize, getUserSubscription);

router.put('/:id/cancel', authorize, cancelSubscription);

export default router;