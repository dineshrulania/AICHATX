import crypto from 'crypto';
import redisClient from './redis.service.js';

const DEFAULT_OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 600);

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function getOtpKey(email, purpose) {
    return `otp:${purpose}:${normalizeEmail(email)}`;
}

function hashOtp(otp) {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

export function generateOtp(length = 6) {
    const min = 10 ** (length - 1);
    const max = (10 ** length) - 1;
    return String(Math.floor(min + Math.random() * (max - min + 1)));
}

export async function createOtpChallenge({ email, purpose, payload = {}, ttlSeconds = DEFAULT_OTP_TTL_SECONDS }) {
    const otp = generateOtp(6);
    const key = getOtpKey(email, purpose);

    await redisClient.set(
        key,
        JSON.stringify({
            hash: hashOtp(otp),
            payload,
            createdAt: Date.now(),
            purpose,
        }),
        'EX',
        ttlSeconds
    );

    return { otp, ttlSeconds };
}

export async function verifyOtpChallenge({ email, purpose, otp }) {
    const key = getOtpKey(email, purpose);
    const raw = await redisClient.get(key);

    if (!raw) {
        throw new Error('OTP expired or not found. Please request a new code.');
    }

    const stored = JSON.parse(raw);

    if (stored.hash !== hashOtp(otp)) {
        throw new Error('Invalid OTP. Please try again.');
    }

    await redisClient.del(key);
    return stored.payload || {};
}