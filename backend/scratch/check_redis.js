const { connectRedis, isRedisConnected } = require('./src/config/redis');
const dotenv = require('dotenv');
dotenv.config();

async function checkRedis() {
  try {
    const client = await connectRedis();
    if (client && isRedisConnected()) {
      console.log('✅ Redis is connected');
      await client.quit();
    } else {
      console.log('❌ Redis is NOT connected');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Redis error:', err.message);
    process.exit(1);
  }
}

checkRedis();
