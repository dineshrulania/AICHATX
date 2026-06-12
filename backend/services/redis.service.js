import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || '';
const isUri = redisHost.startsWith('redis://') || redisHost.startsWith('rediss://');

const redisClient = isUri
    ? new Redis(redisHost)
    : new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
    });

redisClient.on('connect', () => {
    console.log('Redis connected');
});

export default redisClient;