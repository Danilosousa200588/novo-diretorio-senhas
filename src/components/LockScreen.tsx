import React, { useState, useEffect } from 'react';
import { useLock } from '@/context/LockContext';
import { Shield, Fingerprint, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

export default function LockScreen() {
  const { user } = useAuth();
  const { 
    hasBiometricsEnabled, 
    unlockWithPassword, 
    unlockWithBiometrics, 
    isBiometricsSupported, 
    enableBiometrics 
  } = useLock();
  
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEnableBiometrics, setShowEnableBiometrics] = useState(false);

  // Se o usuário tem biometria ativada, tenta chamar automaticamente ao abrir a tela (opcional)
  useEffect(() => {
    if (hasBiometricsEnabled) {
      unlockWithBiometrics();
    }
  }, [hasBiometricsEnabled, unlockWithBiometrics]);

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) return;

    setLoading(true);
    const success = await unlockWithPassword(password);
    setLoading(false);

    if (success && isBiometricsSupported && !hasBiometricsEnabled) {
      // Oferece a biometria se o login por senha for sucesso e suportado, mas não ativo
      setShowEnableBiometrics(true);
    }
  };

  if (showEnableBiometrics) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl space-y-6 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Fingerprint size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-foreground">Gostaria de usar Biometria?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Você pode habilitar o login por biometria (Face ID, Touch ID, Windows Hello) para destrancar o cofre mais rápido da próxima vez.
            </p>
          </div>
          <div className="space-y-3 pt-4">
            <button
              onClick={async () => {
                await enableBiometrics();
                setShowEnableBiometrics(false); // Já foi destrancado pelo sucesso do handlePasswordSubmit
              }}
              className="w-full rounded-xl gradient-primary py-3 font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              Ativar Biometria
            </button>
            <button
              onClick={() => setShowEnableBiometrics(false)}
              className="w-full rounded-xl border border-border bg-transparent py-3 font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Agora não
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        
        <div className="space-y-2">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <Lock size={40} className="text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cofre Protegido</h1>
          <p className="text-sm text-muted-foreground">
            Autentique-se para acessar o cofre de <strong>{user?.email}</strong>
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              placeholder="Sua senha do Supabase"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-card p-4 pl-12 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar com senha'}
          </button>
        </form>

        {isBiometricsSupported && hasBiometricsEnabled && (
          <>
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou</span>
              </div>
            </div>

            <button
              onClick={unlockWithBiometrics}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 py-3.5 font-semibold text-primary transition-all hover:bg-primary/20"
            >
              <Fingerprint size={20} />
              Entrar com biometria
            </button>
          </>
        )}

      </div>
    </div>
  );
}
