import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SENHA_HASH_KEY } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LockContextType {
  isUnlocked: boolean;
  hasBiometricsEnabled: boolean;
  unlockWithPassword: (password: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => void;
  lockVault: () => void;
  isBiometricsSupported: boolean;
}

const LockContext = createContext<LockContextType | null>(null);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasBiometricsEnabled, setHasBiometricsEnabled] = useState(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);

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
    }}>
      {children}
    </LockContext.Provider>
  );
}

export function useLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
}
