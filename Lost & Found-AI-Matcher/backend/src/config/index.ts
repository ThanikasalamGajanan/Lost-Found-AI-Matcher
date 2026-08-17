import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  databaseUrl: process.env.DATABASE_URL || '',

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'noreply@lostfound.ai',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: '7d',
  },

  matching: {
    // Component weights (must sum to 1.00).
    // Raw ratio from spec: description 30, location 20, time 15, attributes 10
    // Scaled proportionally (×100/75) so the total score reaches 100.
    weights: {
      description: 0.40,   // 30 → 40%  (embedding cosine similarity)
      location: 0.27,      // 20 → 27%  (Haversine proximity)
      time: 0.20,          // 15 → 20%  (time-window overlap)
      attributes: 0.13,    // 10 → 13%  (category / colour / brand)
    },
    minScoreThreshold: 40,  // Minimum score (%) to surface a match
    maxRetries: 2,          // Max verification attempts (1 initial + 1 retry, then admin)
    locationRadiusKm: 5,    // Max km for location similarity = 100%
    timeWindowHours: 72,    // Max hours for time similarity = 100%
  },
} as const;
