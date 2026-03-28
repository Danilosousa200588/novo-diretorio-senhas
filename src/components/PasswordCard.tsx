import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Eye, EyeOff, Heart, Pencil, Trash2 } from 'lucide-react';
import { PasswordEntry } from '@/types/password';
import { usePasswords } from '@/context/PasswordContext';
import { useLock } from '@/context/LockContext';
import ServiceLogo from './ServiceLogo';
import { toast } from 'sonner';

interface PasswordCardProps {
  entry: PasswordEntry;
  onEdit: (entry: PasswordEntry) => void;
}

export default function PasswordCard({ entry, onEdit }: PasswordCardProps) {
  const { deleteEntry, toggleFavorite } = usePasswords();
  const { requireAuth } = useLock();
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = async () => {
    const authed = await requireAuth(`Autentique-se para copiar a senha de ${entry.name}.`);
    if (!authed) return;
    navigator.clipboard.writeText(entry.password);
    toast.success('Senha copiada!');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="group relative flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card transition-all hover:shadow-elevated"
    >
      <ServiceLogo domain={entry.domain} name={entry.name} size={48} />

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-sm font-semibold text-card-foreground">
          {entry.name}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{entry.username}</p>
        <div className="mt-1 flex items-center gap-1">
          <span className="font-mono text-xs text-muted-foreground">
            {showPassword ? entry.password : '••••••••••'}
          </span>
        </div>
        {entry.description && (
          <p className="mt-2 text-xs text-muted-foreground border-l-2 border-primary/30 pl-2">
            {entry.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={async () => {
            if (!showPassword) {
              const authed = await requireAuth(`Autentique-se para visualizar a senha de ${entry.name}.`);
              if (authed) setShowPassword(true);
            } else {
              setShowPassword(false);
            }
          }}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button
          onClick={copyToClipboard}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Copy size={16} />
        </button>
        <button
          onClick={() => toggleFavorite(entry.id)}
          className="rounded-lg p-2 transition-colors hover:bg-secondary"
        >
          <Heart
            size={16}
            className={entry.favorite ? 'fill-destructive text-destructive' : 'text-muted-foreground'}
          />
        </button>
        <button
          onClick={async () => {
            const authed = await requireAuth(`Autentique-se para editar ${entry.name}.`);
            if (authed) onEdit(entry);
          }}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={async () => {
            const authed = await requireAuth(`Autentique-se para excluir ${entry.name}.`);
            if (authed) {
              deleteEntry(entry.id);
              toast.success('Senha removida');
            }
          }}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
}
