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
    weights: {
      description: 0.30,
      image: 0.25,
      location: 0.20,
      time: 0.15,
      attributes: 0.10,
    },
    minScoreThreshold: 40,  // Minimum score (%) to surface a match
    maxRetries: 3,          // Max verification retries before escalation
    locationRadiusKm: 5,    // Max km for location similarity = 100%
    timeWindowHours: 72,    // Max hours for time similarity = 100%
  },
} as const;
