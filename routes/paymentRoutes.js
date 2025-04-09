const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const {
    initiatePayment,
    checkPaymentStatus,
    getPaymentHistory
} = require('../controllers/paymentController');

router.use(authMiddleware);

router.post('/initiate', initiatePayment);
router.get('/status/:paymentId', checkPaymentStatus);
router.get('/history', getPaymentHistory);

module.exports = router;