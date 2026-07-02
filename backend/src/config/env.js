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
  APP_URL:      optional("APP_URL", "https://tabliereci.net"),
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:3000"),

  // SendGrid (email)
  SENDGRID_API_KEY: optional("SENDGRID_API_KEY", ""),
  EMAIL_FROM:       optional("EMAIL_FROM", "noreply@tabliereci.net"),

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

// ── Garde-fou sécurité : en production, refuser le secret JWT par défaut ───────
// JWT_SECRET signe TOUS les tokens (access + refresh). Sa valeur par défaut est
// publique dans le code : un attaquant pourrait forger des tokens admin. On
// refuse de démarrer si elle n'a pas été surchargée en production.
// (JWT_REFRESH_SECRET n'est pas encore utilisé pour signer → simple avertissement,
//  pour ne pas crasher un déploiement où seule JWT_SECRET est définie.)
if (env.isProd) {
  if (env.JWT_SECRET === "change_me_in_production_super_secret_key") {
    throw new Error(
      "[SÉCURITÉ] JWT_SECRET par défaut détecté en production. " +
      "Définissez une valeur aléatoire forte (>=32 octets) dans les variables d'environnement avant de démarrer."
    );
  }
  if (env.JWT_REFRESH_SECRET === "change_me_refresh_secret_key") {
    console.warn("[SÉCURITÉ] JWT_REFRESH_SECRET utilise la valeur par défaut — à définir avant utilisation.");
  }
}

export const config = env; // alias pour compatibilité avec qr.service.js
