import mongoose from 'mongoose';
import { isRedisConnected } from '../config/redis';

const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

export const getSystemHealth = async () => {
  const m = process.memoryUsage();
  const cpu = process.cpuUsage();

  return {
    app: {
      uptimeSec: Math.round(process.uptime()),
      nodeVersion: process.version,
      pid: process.pid,
    },
    memory: {
      rssMB: toMB(m.rss),
      heapUsedMB: toMB(m.heapUsed),
      heapTotalMB: toMB(m.heapTotal),
      externalMB: toMB(m.external),
    },
    cpu: {
      userMs: Math.round(cpu.user / 1000),
      systemMs: Math.round(cpu.system / 1000),
      loadAvg: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
    },
    db: {
      mongoReadyState: mongoose.connection.readyState,
      mongoConnected: mongoose.connection.readyState === 1,
      redisConnected: isRedisConnected(),
    },
    timestamp: new Date().toISOString(),
  };
};

export const getPrometheusText = async () => {
  const health = await getSystemHealth();
  return [
    '# HELP app_uptime_seconds Process uptime in seconds',
    '# TYPE app_uptime_seconds gauge',
    `app_uptime_seconds ${health.app.uptimeSec}`,
    '# HELP app_memory_rss_mb Resident memory in MB',
    '# TYPE app_memory_rss_mb gauge',
    `app_memory_rss_mb ${health.memory.rssMB}`,
    '# HELP app_memory_heap_used_mb Heap used in MB',
    '# TYPE app_memory_heap_used_mb gauge',
    `app_memory_heap_used_mb ${health.memory.heapUsedMB}`,
    '# HELP app_mongo_connected Mongo connection state (1 connected, 0 disconnected)',
    '# TYPE app_mongo_connected gauge',
    `app_mongo_connected ${health.db.mongoConnected ? 1 : 0}`,
    '# HELP app_redis_connected Redis connection state (1 connected, 0 disconnected)',
    '# TYPE app_redis_connected gauge',
    `app_redis_connected ${health.db.redisConnected ? 1 : 0}`,
  ].join('\n');
};
