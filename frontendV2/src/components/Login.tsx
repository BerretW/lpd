
import React, { useState } from 'react';
import Button from './common/Button';
import Icon from './common/Icon';
import { useAuth } from '../AuthContext';
import { useI18n } from '../I18nContext';
import Input from './common/Input';

const Login: React.FC = () => {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password, rememberMe });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-slate-200">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center">
            <div className="inline-block bg-red-600 p-4 rounded-full mb-4">
                 <Icon name="fa-shield-halved" className="text-white text-4xl" />
            </div>
          <h2 className="text-3xl font-bold text-slate-900">{t('login.title')}</h2>
          <p className="mt-2 text-slate-600">{t('login.prompt')}</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && <p className="text-center text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}
          <div className="rounded-md shadow-sm space-y-4">
            <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900">
                {t('login.rememberMe')}
              </label>
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full justify-center py-3" disabled={loading}>
              {loading ? t('login.loggingIn') : t('login.loginButton')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
