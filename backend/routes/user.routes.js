import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { body } from 'express-validator';
import * as authMiddleware from '../middleware/auth.middleware.js';

const router = Router();



router.post('/register',
    body('email').isEmail().withMessage('Email must be a valid email address'),
    body('password').isLength({ min: 3 }).withMessage('Password must be at least 3 characters long'),
    userController.createUserController);

router.post('/register/verify-otp',
    body('email').isEmail().withMessage('Email must be a valid email address'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits long'),
    userController.verifyRegisterOtpController);

router.post('/login',
    body('email').isEmail().withMessage('Email must be a valid email address'),
    body('password').isLength({ min: 3 }).withMessage('Password must be at least 3 characters long'),
    userController.loginController);

router.post('/login/verify-otp',
    body('email').isEmail().withMessage('Email must be a valid email address'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits long'),
    userController.verifyLoginOtpController);

router.get('/profile', authMiddleware.authUser, userController.profileController);


router.get('/logout', authMiddleware.authUser, userController.logoutController);


router.get('/all', authMiddleware.authUser, userController.getAllUsersController);


export default router;
