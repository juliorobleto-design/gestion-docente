import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Lock, Mail, ArrowRight, ShieldCheck, KeyRound, Sparkles } from 'lucide-react';

const blockedDomains = [
  "mep.go.cr",
  "go.cr"
];

interface AuthProps {
  externalError?: string | null;
}

export default function Auth({ externalError }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [authMode, setAuthMode] = useState<'magiclink' | 'password'>('magiclink');

  const validateEmail = (em: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.toLowerCase());

  const validateAndCheck = async (): Promise<string | null> => {
    if (!email.trim()) return 'Por favor, ingresa tu correo electrónico.';
    if (!validateEmail(email)) return 'El formato del correo no es válido.';

    const normalizedEmail = email.trim().toLowerCase();
    const domain = normalizedEmail.split('@')[1];
    
    if (blockedDomains.some(d => domain.endsWith(d))) {
      return 'Usa un correo personal (@gmail, @outlook, etc.) para ingresar. Los correos institucionales (@mep.go.cr o .go.cr) no están habilitados en esta etapa.';
    }

    // Validar Lista Blanca
    const { data: isAuthorized, error: rpcError } = await supabase.rpc(
      'is_email_authorized',
      { input_email: normalizedEmail }
    );

    if (rpcError) throw rpcError;
    if (!isAuthorized) {
      return 'Acceso restringido. Este correo no está autorizado para la fase beta. Solicita acceso al administrador.';
    }

    return null; // Todo OK
  };

  // ═══════════ MAGIC LINK ═══════════
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const validationError = await validateAndCheck();
      if (validationError) {
        setMessage({ type: 'error', text: validationError });
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin },
      });

      if (error) throw error;
      setMessage({ type: 'success', text: '¡Enlace enviado! Revisa tu bandeja de entrada.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.error_description || error.message || 'Error al procesar el acceso.' });
    } finally {
      setLoading(false);
    }
  };

  // ═══════════ PASSWORD LOGIN ═══════════
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!password.trim()) {
      setMessage({ type: 'error', text: 'Por favor, ingresa tu contraseña.' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    setLoading(true);
    try {
      const validationError = await validateAndCheck();
      if (validationError) {
        setMessage({ type: 'error', text: validationError });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Intentar login con contraseña
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          // Puede ser que el usuario no tiene contraseña aún, intentar signup
          const { error: signUpError } = await supabase.auth.signUp({
            email: normalizedEmail,
            password: password,
          });

          if (signUpError) {
            if (signUpError.message.includes('already registered')) {
              setMessage({ type: 'error', text: 'Contraseña incorrecta. Si olvidaste tu contraseña, usa el Enlace Mágico para ingresar.' });
            } else {
              throw signUpError;
            }
          } else {
            // Signup exitoso, intentar login de nuevo
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password: password,
            });
            if (retryError) {
              setMessage({ type: 'success', text: '¡Cuenta creada! Revisa tu correo para confirmar y luego podrás ingresar con tu contraseña.' });
            } else {
              setMessage({ type: 'success', text: '¡Bienvenido!' });
            }
          }
        } else {
          throw error;
        }
      } else {
        setMessage({ type: 'success', text: '¡Acceso exitoso!' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al procesar el acceso.' });
    } finally {
      setLoading(false);
    }
  };

  const isLocalhost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.startsWith('192.168.') || 
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.endsWith('.local');

  const handleBypassAuth = () => {
    const mockSession = {
      user: {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'monetizamundolocura@gmail.com',
        user_metadata: { full_name: 'Usuario de Pruebas' }
      },
      access_token: 'mock-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };
    localStorage.setItem('gd_debug_session', JSON.stringify(mockSession));
    window.location.reload();
  };

  // Error consolidado
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

        {/* Dynamic Error Box */}
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

        {/* Auth Mode Toggle */}
        <div className="mt-8 flex bg-[#f1f5f9] rounded-2xl p-1 gap-1">
          <button
            type="button"
            onClick={() => { setAuthMode('magiclink'); setMessage(null); }}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'magiclink' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-[#64748b] hover:text-[#334155]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Enlace Mágico
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('password'); setMessage(null); }}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'password' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-[#64748b] hover:text-[#334155]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Contraseña
          </button>
        </div>

        {/* Auth Form */}
        <div className="mt-6 space-y-4">
          <form onSubmit={authMode === 'magiclink' ? handleMagicLink : handlePasswordLogin} className="space-y-4">
            {/* Email Input */}
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

            {/* Password Input (solo en modo contraseña) */}
            {authMode === 'password' && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600">
                  <KeyRound className="h-5 w-5 text-[#94a3b8]" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full h-14 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-12 py-3 text-[#1e293b] text-[15px] font-medium placeholder:text-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  placeholder="Tu contraseña (mínimo 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-blue-600 text-white rounded-2xl font-black text-[15px] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : authMode === 'magiclink' ? (
                <>
                  Enviar Enlace de Acceso
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                <>
                  Ingresar con Contraseña
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Hint para contraseña */}
          {authMode === 'password' && (
            <p className="text-[11px] text-center text-[#94a3b8] font-medium leading-relaxed">
              Si es tu primera vez, se creará una cuenta automáticamente.
              <br />Si olvidaste tu contraseña, usa <button type="button" onClick={() => setAuthMode('magiclink')} className="text-blue-500 font-bold hover:underline">Enlace Mágico</button>.
            </p>
          )}

          {isLocalhost && (
            <div className="pt-4 border-t border-[#f1f5f9] mt-6 space-y-3">
              <button
                onClick={handleBypassAuth}
                className="w-full h-12 bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl font-bold text-[13px] hover:bg-slate-100 transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
              >
                <ArrowRight className="w-4 h-4" />
                Entrar Directo (Modo UI)
              </button>
              
              <p className="text-[10px] text-center text-slate-400 mt-2 font-bold uppercase tracking-wider">Solo Desarrollo - DB puede fallar</p>
            </div>
          )}
        </div>

        {/* Footer Security Note */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-black text-[#94a3b8] uppercase tracking-widest mb-3">
            <Lock className="w-3.5 h-3.5" /> Seguridad de nivel bancario
          </div>
          <p className="text-[12px] text-[#94a3b8] leading-relaxed max-w-[280px] mx-auto">
            Acceso cifrado y seguro para proteger tu información docente.
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