import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SENHA_HASH_KEY } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Shield, Loader2, X } from 'lucide-react';

interface LockContextType {
  isUnlocked: boolean;
  hasBiometricsEnabled: boolean;
  unlockWithPassword: (password: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => void;
  lockVault: () => void;
  isBiometricsSupported: boolean;
  requireAuth: (reason?: string) => Promise<boolean>;
}

const LockContext = createContext<LockContextType | null>(null);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasBiometricsEnabled, setHasBiometricsEnabled] = useState(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [authRequest, setAuthRequest] = useState<{ resolve: (v: boolean) => void; reason?: string } | null>(null);

  useEffect(() => {
    // Verificar suporte a WebAuthn (Biometria nativa do dispositivo)
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((supported) => {
          setIsBiometricsSupported(supported);
        })
        .catch(() => setIsBiometricsSupported(false));
    } else {
      setIsBiometricsSupported(false);
    }
  }, []);

  useEffect(() => {
    // Trancar o cofre sempre que recarregar ou mudar de usuário
    setIsUnlocked(false);

    // Verificar se o usuário ativou a biometria localmente
    if (user) {
      const storedId = localStorage.getItem(`biometric_id_${user.id}`);
      setHasBiometricsEnabled(!!storedId);
    } else {
      setHasBiometricsEnabled(false);
    }
  }, [user]);

  const unlockWithPassword = useCallback(async (password: string) => {
    if (!user?.email) return false;
    try {
      // Compara com o hash salvo localmente durante o login (sem chamar a API)
      const savedHash = sessionStorage.getItem(SENHA_HASH_KEY);
      if (!savedHash) {
        // Se não tiver hash local (ex: sessão persistida de outra aba), usa API do Supabase
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: password,
        });
        if (error) {
          toast.error('Senha incorreta!');
          return false;
        }
        // Salva o hash para futuros desbloqueios
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const h = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem(SENHA_HASH_KEY, h);
        setIsUnlocked(true);
        return true;
      }

      // Gera o hash da senha digitada e compara
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const inputHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      if (inputHash !== savedHash) {
        toast.error('Senha incorreta!');
        return false;
      }

      setIsUnlocked(true);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao validar senha');
      return false;
    }
  }, [user]);

  const enableBiometrics = useCallback(async () => {
    if (!user) return false;
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const userIdBuffer = new Uint8Array(16);
      window.crypto.getRandomValues(userIdBuffer);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Vault Protegido", id: window.location.hostname },
          user: {
            id: userIdBuffer,
            name: user.email || 'usuário',
            displayName: user.email || 'Usuário',
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },    // ES256
            { type: "public-key", alg: -257 },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Usar biometria do dispositivo (FaceID, TouchID, Windows Hello)
            userVerification: "required",
          },
          timeout: 60000,
        }
      });

      if (credential) {
        // Salvar localmente
        // @ts-ignore
        const rawId = Array.from(new Uint8Array(credential.rawId));
        localStorage.setItem(`biometric_id_${user.id}`, JSON.stringify(rawId));
        setHasBiometricsEnabled(true);
        toast.success('Biometria ativada com sucesso!');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(err);
      toast.error('Não foi possível ativar a biometria. ' + (err.message || ''));
      return false;
    }
  }, [user]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!user) return false;
    try {
      const storedIdStr = localStorage.getItem(`biometric_id_${user.id}`);
      if (!storedIdStr) {
        toast.error('Biometria não configurada.');
        return false;
      }

      const rawIdArray = JSON.parse(storedIdStr);
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: new Uint8Array(rawIdArray),
            type: "public-key",
          }],
          userVerification: "required",
        }
      });

      setIsUnlocked(true);
      return true;
    } catch (err: any) {
      console.error(err);
      toast.error('Falha na autenticação biométrica.');
      return false;
    }
  }, [user]);

  const disableBiometrics = useCallback(() => {
    if (!user) return;
    localStorage.removeItem(`biometric_id_${user.id}`);
    setHasBiometricsEnabled(false);
    toast.success('Biometria desativada deste dispositivo.');
  }, [user]);

  const lockVault = useCallback(() => {
    setIsUnlocked(false);
    toast.info('Cofre bloqueado');
  }, []);

  const requireAuth = useCallback(async (reason?: string) => {
    if (hasBiometricsEnabled && isBiometricsSupported) {
      try {
        const storedIdStr = localStorage.getItem(`biometric_id_${user?.id}`);
        if (storedIdStr) {
          const rawIdArray = JSON.parse(storedIdStr);
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [{
                id: new Uint8Array(rawIdArray),
                type: "public-key",
              }],
              userVerification: "required",
            }
          });
          return true; // Autenticação biométrica bem-sucedida!
        }
      } catch (err: any) {
        console.warn('Biometria falhou ou foi cancelada, pedindo senha', err);
      }
    }

    // Pass fallback ou se biometria não habilitada
    return new Promise<boolean>((resolve) => {
      setAuthRequest({ resolve, reason });
    });
  }, [hasBiometricsEnabled, isBiometricsSupported, user]);

  return (
    <LockContext.Provider value={{
      isUnlocked,
      hasBiometricsEnabled,
      unlockWithPassword,
      unlockWithBiometrics,
      enableBiometrics,
      disableBiometrics,
      lockVault,
      isBiometricsSupported,
      requireAuth,
    }}>
      {children}
      {authRequest && (
        <AuthPromptModal 
          reason={authRequest.reason}
          onSuccess={() => { authRequest.resolve(true); setAuthRequest(null); }}
          onCancel={() => { authRequest.resolve(false); setAuthRequest(null); }}
          userEmail={user?.email || ''}
        />
      )}
    </LockContext.Provider>
  );
}

function AuthPromptModal({ reason, onSuccess, onCancel, userEmail }: { reason?: string, onSuccess: () => void, onCancel: () => void, userEmail: string }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);

    try {
      const savedHash = sessionStorage.getItem(SENHA_HASH_KEY);
      if (savedHash) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const inputHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        if (inputHash === savedHash) {
          onSuccess();
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: password,
        });
        if (!error) {
          const encoder = new TextEncoder();
          const data = encoder.encode(password);
          const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const h = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
          sessionStorage.setItem(SENHA_HASH_KEY, h);
          onSuccess();
          return;
        }
      }
      toast.error('Senha incorreta!');
    } catch {
      toast.error('Erro ao verificar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl relative">
        <button onClick={onCancel} className="absolute right-4 top-4 p-2 text-muted-foreground hover:bg-secondary rounded-xl transition-colors">
          <X size={20} />
        </button>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-glow ring-1 ring-inset ring-destructive/20">
            <Shield size={32} />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">Ação Protegida</h2>
          <p className="mt-2 text-sm text-muted-foreground">{reason || 'Por favor, confirme sua identidade para prosseguir.'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Sua senha do Supabase"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-input bg-background p-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function useLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
}
