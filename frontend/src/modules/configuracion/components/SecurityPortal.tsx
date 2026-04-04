import React, { useState, useEffect } from "react";
import { Shield, Mail, CheckCircle2, AlertTriangle, Loader2, ArrowRight, UserCheck } from "lucide-react";
import { supabase } from "../../../supabaseClient";

type MigrationStatus = {
  old_user_id: number;
  username: string;
  email_real: string;
  new_auth_user_id: string | null;
  migration_status: string;
  first_login_at: string | null;
};

export default function SecurityPortal({ session }: { session?: any }) {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchMigrationStatus();
  }, []);

  const fetchMigrationStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("user_migration_map")
        .select("*")
        .eq("old_user_id", 1) // Enfocado en julio por ahora
        .single();

      if (data) setStatus(data);
    } catch (err) {
      console.error("Error al cargar estado de migración:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!status?.email_real) return;
    
    setSendingEmail(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: status.email_real,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      // Actualizar estado en el mapa
      await supabase
        .from("user_migration_map")
        .update({ migration_status: "sent", magic_link_sent_at: new Date().toISOString() })
        .eq("old_user_id", 1);

      setMessage({ type: "success", text: `Enlace enviado a ${status.email_real}. Revisa tu bandeja de entrada.` });
      fetchMigrationStatus();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error al enviar el enlace." });
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
        <Loader2 className="animate-spin text-indigo-500 mr-2" size={20} />
        <span className="text-slate-500 font-medium">Cargando centro de seguridad...</span>
      </div>
    );
  }

  const isMigrated = !!status?.new_auth_user_id;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
      <div className="bg-slate-50 p-6 border-bottom border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Centro de Blindaje y Auth</h3>
            <p className="text-sm text-slate-500 font-medium">Hito 1: Validación de Identidad Segura</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
          isMigrated ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}>
          {isMigrated ? "Identidad Vinculada" : "Pendiente de Vínculo"}
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Cuenta Legacy</label>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                  {status?.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700">{status?.username}</div>
                  <div className="text-[11px] text-slate-400 font-medium">ID Legado: {status?.old_user_id}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Nueva Identidad Segura</label>
              <div className="flex items-center gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700">{status?.email_real}</div>
                  <div className="text-[11px] text-indigo-500 font-bold">Correo Personal Confirmado</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
            {isMigrated ? (
              <div className="text-center space-y-4">
                <div className="inline-flex bg-emerald-100 p-3 rounded-full text-emerald-600 mb-2">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="font-bold text-slate-800">¡Identidad Validada!</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Tu cuenta ha sido vinculada exitosamente con Supabase Auth. Tu nuevo UUID ya está registrado.
                </p>
                <div className="text-[10px] font-mono bg-white p-2 rounded border border-slate-200 text-slate-400 break-all">
                  UUID: {status?.new_auth_user_id}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600 shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Para asegurar tu cuenta, te enviaremos un **Magic Link** a tu correo real. Al hacer clic, tu identidad quedará vinculada permanentemente.
                  </p>
                </div>

                <button 
                  onClick={handleSendMagicLink}
                  disabled={sendingEmail}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 group"
                >
                  {sendingEmail ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      Enviar Magic Link
                      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
                
                {message && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
                  }`}>
                    {message.text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isMigrated ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`}></div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">
            {isMigrated ? "Fase 2 Preparada: Migración de Ownership" : "Esperando validación de identidad"}
          </span>
        </div>
        {isMigrated && (
          <div className="flex items-center gap-1 text-emerald-600">
             <UserCheck size={14} />
             <span className="text-[11px] font-bold uppercase tracking-tighter">Sesión Activa</span>
          </div>
        )}
      </div>
    </div>
  );
}
