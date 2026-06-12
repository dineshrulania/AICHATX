import userModel from '../models/user.model.js';
import * as userService from '../services/user.service.js';
import { validationResult } from 'express-validator';
import redisClient from '../services/redis.service.js';
import { createOtpChallenge, verifyOtpChallenge } from '../services/otp.service.js';
import { sendVerificationOtpEmail } from '../services/email.service.js';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}


export const createUserController = async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {

        const { email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);

        const existingUser = await userModel.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const passwordHash = await userModel.hashPassword(password);
        const { otp } = await createOtpChallenge({
            email: normalizedEmail,
            purpose: 'register',
            payload: { passwordHash },
        });

        await sendVerificationOtpEmail({
            toEmail: normalizedEmail,
            otp,
            purpose: 'register',
        });

        return res.status(200).json({
            message: 'Verification code sent to your email',
            email: normalizedEmail,
            requiresOtp: true,
        });
    } catch (error) {
        res.status(400).send(error.message);
    }
}

export const loginController = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);

        const user = await userModel.findOne({ email: normalizedEmail }).select('+password');

        if (!user) {
            return res.status(401).json({
                errors: 'Invalid credentials'
            })
        }

        const isMatch = await user.isValidPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                errors: 'Invalid credentials'
            })
        }

        const { otp } = await createOtpChallenge({
            email: normalizedEmail,
            purpose: 'login',
            payload: { userId: user._id.toString() },
        });

        await sendVerificationOtpEmail({
            toEmail: normalizedEmail,
            otp,
            purpose: 'login',
        });

        return res.status(200).json({
            message: 'Verification code sent to your email',
            email: normalizedEmail,
            requiresOtp: true,
        });


    } catch (err) {

        console.log(err);

        res.status(400).send(err.message);
    }
}

export const verifyRegisterOtpController = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, otp } = req.body;
        const normalizedEmail = normalizeEmail(email);

        const existingUser = await userModel.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const { passwordHash } = await verifyOtpChallenge({
            email: normalizedEmail,
            purpose: 'register',
            otp,
        });

        const user = await userModel.create({
            email: normalizedEmail,
            password: passwordHash,
        });

        const token = await user.generateJWT();
        delete user._doc.password;

        return res.status(201).json({ user, token });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
};

export const verifyLoginOtpController = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, otp } = req.body;
        const normalizedEmail = normalizeEmail(email);

        const { userId } = await verifyOtpChallenge({
            email: normalizedEmail,
            purpose: 'login',
            otp,
        });

        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const token = await user.generateJWT();
        delete user._doc.password;

        return res.status(200).json({ user, token });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
};

export const profileController = async (req, res) => {

    res.status(200).json({
        user: req.user
    });

}

export const logoutController = async (req, res) => {
    try {

        const token = req.cookies.token || req.headers.authorization.split(' ')[ 1 ];

        redisClient.set(token, 'logout', 'EX', 60 * 60 * 24);

        res.status(200).json({
            message: 'Logged out successfully'
        });


    } catch (err) {
        console.log(err);
        res.status(400).send(err.message);
    }
}

export const getAllUsersController = async (req, res) => {
    try {

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })

        const allUsers = await userService.getAllUsers({ userId: loggedInUser._id });

        return res.status(200).json({
            users: allUsers
        })

    } catch (err) {

        console.log(err)

        res.status(400).json({ error: err.message })

    }
}
