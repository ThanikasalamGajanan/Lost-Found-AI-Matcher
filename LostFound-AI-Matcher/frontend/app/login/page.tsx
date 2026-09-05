'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { User as UserType } from '@/types';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const decoded = JSON.parse(json) as { sub?: string };
    return decoded.sub || null;
  } catch {
    return null;
  }
}

interface FormErrors {
  email?: string;
  password?: string;
  fullName?: string;
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const { login, logout } = useAuthStore();

  const router = useRouter();

  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email';
        return undefined;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return undefined;
      case 'fullName':
        if (mode === 'signup' && !value.trim()) return 'Full name is required';
        if (mode === 'signup' && value.trim().length < 2) return 'Full name is too short';
        return undefined;
      default:
        return undefined;
    }
  };

  const handleBlur = (name: string, value: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const validateAll = (): boolean => {
    const next: FormErrors = {
      email: validateField('email', email),
      password: validateField('password', password),
      fullName: validateField('fullName', fullName),
    };
    setErrors(next);
    setTouched({ email: true, password: true, fullName: true });
    return Object.values(next).every((e) => !e);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    setLoading(true);
    logout();
    try {
      let user;
      let token;

      if (mode === 'signup') {
        const res = await authApi.signup(email, password, fullName);
        user = res.user;
        token = res.token;
      } else {
        const res = await authApi.login(email, password);
        user = res.user;
        token = res.token;
      }

      const tokenUserId = decodeJwtSub(token);
      if (!tokenUserId || tokenUserId !== user.id) {
        toast.error('Server returned mismatched session. Please log in again.');
        setLoading(false);
        return;
      }

      login(
        {
          ...user,
          full_name: user.full_name || (mode === 'signup' ? fullName : ''),
          preferred_lang: (user.preferred_lang || 'en') as UserType['preferred_lang'],
          created_at: user.created_at || new Date().toISOString(),
        } as UserType,
        token
      );

      toast.success(mode === 'signup' ? 'Account created!' : 'Welcome back!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setErrors({});
    setTouched({});
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="card w-full max-w-md p-6 sm:p-8">
        {/* Tabs */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-8">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              mode === 'login'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              mode === 'signup'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">
          {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-center text-gray-500 text-sm mb-8">
          {mode === 'signup'
            ? 'Join us to report and recover lost items.'
            : 'Log in to view your reports and matches.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {mode === 'signup' && (
            <InputField
              id="fullName"
              label="Full Name"
              type="text"
              value={fullName}
              onChange={setFullName}
              onBlur={handleBlur}
              error={touched.fullName ? errors.fullName : undefined}
              icon={User}
              placeholder="John Doe"
            />
          )}

          <InputField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            onBlur={handleBlur}
            error={touched.email ? errors.email : undefined}
            icon={Mail}
            placeholder="you@example.com"
          />

          <InputField
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            onBlur={handleBlur}
            error={touched.password ? errors.password : undefined}
            icon={Lock}
            placeholder="••••••••"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          <button
            type="submit"
            className="btn-primary w-full flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Please wait...
              </>
            ) : mode === 'signup' ? (
              'Create Account'
            ) : (
              'Log In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function InputField({
  id,
  label,
  type,
  value,
  onChange,
  onBlur,
  error,
  icon: Icon,
  placeholder,
  trailing,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: (name: string, value: string) => void;
  error?: string;
  icon: React.ElementType;
  placeholder: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(id, e.target.value)}
          placeholder={placeholder}
          className={`input-field pl-10 ${trailing ? 'pr-10' : ''} ${
            error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
          }`}
        />
        {trailing && <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
