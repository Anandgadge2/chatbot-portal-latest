const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'] as const;

export const validateRequiredEnv = (): void => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
