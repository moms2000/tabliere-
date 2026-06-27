import "dotenv/config";

function optional(name, fallback) {
  return process.env[name] ?? fallback;
}

export const env = {
  NODE_ENV:   optional("NODE_ENV", "development"),
  PORT:       parseInt(optional("PORT", "4000")),
  isProd:     optional("NODE_ENV", "development") === "production",

  // Base de données
  DATABASE_URL: optional("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tabliereci"),

  // JWT
  JWT_SECRET:         optional("JWT_SECRET", "change_me_in_production_super_secret_key"),
  JWT_REFRESH_SECRET: optional("JWT_REFRESH_SECRET", "change_me_refresh_secret_key"),
  JWT_EXPIRES_IN:     optional("JWT_EXPIRES_IN", "15m"),
  JWT_REFRESH_IN:     optional("JWT_REFRESH_IN", "30d"),

  // Redis
  REDIS_HOST:     optional("REDIS_HOST", "localhost"),
  REDIS_PORT:     parseInt(optional("REDIS_PORT", "6379")),
  REDIS_PASSWORD: optional("REDIS_PASSWORD", ""),

  // App
  APP_URL:      optional("APP_URL", "https://tabliereci.ci"),
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:3000"),

  // WhatsApp Business API
  WHATSAPP_TOKEN:    optional("WHATSAPP_TOKEN", ""),
  WHATSAPP_PHONE_ID: optional("WHATSAPP_PHONE_ID", ""),

  // Orange Money CI
  ORANGE_MONEY_API_KEY:    optional("ORANGE_MONEY_API_KEY", ""),
  ORANGE_MONEY_API_SECRET: optional("ORANGE_MONEY_API_SECRET", ""),
  ORANGE_MONEY_BASE_URL:   optional("ORANGE_MONEY_BASE_URL", "https://api.orange.com/orange-money-webpay/ci/v1"),

  // MTN MoMo
  MTN_MOMO_API_KEY:     optional("MTN_MOMO_API_KEY", ""),
  MTN_MOMO_USER_ID:     optional("MTN_MOMO_USER_ID", ""),
  MTN_MOMO_API_SECRET:  optional("MTN_MOMO_API_SECRET", ""),
  MTN_MOMO_BASE_URL:    optional("MTN_MOMO_BASE_URL", "https://sandbox.momodeveloper.mtn.com"),
  MTN_MOMO_ENVIRONMENT: optional("MTN_MOMO_ENVIRONMENT", "sandbox"),

  // Wave
  WAVE_API_KEY:  optional("WAVE_API_KEY", ""),
  WAVE_BASE_URL: optional("WAVE_BASE_URL", "https://api.wave.com/v1"),

  // Stripe (cartes)
  STRIPE_SECRET_KEY:     optional("STRIPE_SECRET_KEY", ""),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET", ""),
};

export const config = env; // alias pour compatibilité avec qr.service.js
