import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

const blockedDomains = [
  "mep.go.cr",
  "go.cr"
];

interface AuthProps {
  externalError?: string | null;
}

export default function Auth({ externalError }: AuthProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Por favor, ingresa tu correo electrónico.' });
      return;
    }

    if (!validateEmail(email)) {
      setMessage({ type: 'error', text: 'El formato del correo no es válido.' });
      return;
    }

    const domain = email.split('@')[1];
    if (blockedDomains.some(d => domain.toLowerCase().endsWith(d.toLowerCase()))) {
      setMessage({ type: 'error', text: 'Usa un correo personal (@gmail, @outlook, etc.) para ingresar. Los correos institucionales (@mep.go.cr o .go.cr) no están habilitados en esta etapa.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      setMessage({ type: 'success', text: '¡Enlace enviado! Revisa tu bandeja de entrada.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.error_description || error.message || 'Error al enviar el enlace.' });
    } finally {
      setLoading(false);
    }
  };

  /* DESHABILITADO TEMPORALMENTE: Google Login
  const handleGoogleLogin = async () => {
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al conectar con Google.' });
    }
  };
  */

  // Error consolidado (incluyendo el externo que venga de App.tsx por bloqueo de dominio post-login)
  const displayError = externalError || (message?.type === 'error' ? message.text : null);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
      <div className="max-w-[440px] w-full bg-white p-10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-[#f1f5f9] relative overflow-hidden">
        {/* Background Accent Gradient */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>

        <div className="text-center relative">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-blue-600 mb-8 shadow-xl shadow-blue-200">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-[32px] font-black text-[#0f172a] tracking-tight leading-none mb-3">
            Gestión Docente
          </h1>
          <p className="text-[#64748b] text-base font-medium">
            Ingresa de forma rápida y segura
          </p>
        </div>

        {/* Dynamic Error Box - Soft Visual Style */}
        {(displayError) && (
          <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-2"></div>
              <p className="text-sm font-semibold text-red-600 leading-relaxed">
                {displayError}
              </p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {message?.type === 'success' && (
          <div className="mt-8 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <p className="text-sm font-semibold text-emerald-700 text-center">
              {message.text}
            </p>
          </div>
        )}

        {/* Auth Actions */}
        <div className="mt-10 space-y-5">
          {/* Google OAuth Button - DESHABILITADO TEMPORALMENTE
          <button
            onClick={handleGoogleLogin}
            className="w-full h-14 flex items-center justify-center gap-3 bg-white border border-[#e2e8f0] rounded-2xl text-[#1e293b] font-bold text-[15px] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all transform active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-[#f1f5f9]"></div>
            <span className="flex-shrink mx-4 text-xs font-bold text-[#94a3b8] uppercase tracking-widest">o accede con tu correo</span>
            <div className="flex-grow border-t border-[#f1f5f9]"></div>
          </div>
          */}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600">
                <Mail className="h-5 w-5 text-[#94a3b8]" />
              </div>
              <input
                type="email"
                required
                className="w-full h-14 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-12 py-3 text-[#1e293b] text-[15px] font-medium placeholder:text-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-blue-600 text-white rounded-2xl font-black text-[15px] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Enviar Enlace de Acceso
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Security Note */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-black text-[#94a3b8] uppercase tracking-widest mb-3">
            <Lock className="w-3.5 h-3.5" /> Seguridad de nivel bancario
          </div>
          <p className="text-[12px] text-[#94a3b8] leading-relaxed max-w-[280px] mx-auto">
            Acceso cifrado y seguro sin contraseñas para proteger tu información docente.
          </p>
        </div>
      </div>

      {/* Corporate Support Note */}
      <p className="mt-8 text-sm font-bold text-[#64748b]">
        By Marketing IA CR
      </p>
    </div>
  );
}