import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, RefreshCw, X, ChevronDown, Sparkles } from 'lucide-react';
import { PasswordEntry, Category } from '@/types/password';
import { usePasswords } from '@/context/PasswordContext';
import { categories, presetServices, guessDomain } from '@/data/presets';
import { generatePassword } from '@/lib/passwordUtils';
import PasswordStrengthBar from './PasswordStrengthBar';
import ServiceLogo from './ServiceLogo';
import AIAnalysisPanel from './AIAnalysisPanel';
import { toast } from 'sonner';

interface PasswordFormProps {
  entry?: PasswordEntry | null;
  presetCategory?: Category;
  presetName?: string;
  presetDomain?: string;
  onClose: () => void;
}

export default function PasswordForm({ entry, presetCategory, presetName, presetDomain, onClose }: PasswordFormProps) {
  const { addEntry, updateEntry } = usePasswords();
  const [showPassword, setShowPassword] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);

  const [name, setName] = useState(entry?.name || presetName || '');
  const [domain, setDomain] = useState(entry?.domain || presetDomain || '');
  const [username, setUsername] = useState(entry?.username || '');
  const [password, setPassword] = useState(entry?.password || '');
  const [category, setCategory] = useState<Category>(entry?.category || presetCategory || 'other');
  const [favorite, setFavorite] = useState(entry?.favorite || false);
  const [description, setDescription] = useState(entry?.description || '');

  useEffect(() => {
    if (!entry && name && !domain) {
      const preset = presetServices.find(s => s.name.toLowerCase() === name.toLowerCase());
      setDomain(preset ? preset.domain : guessDomain(name));
    }
  }, [name, entry, domain]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) {
      toast.error('Nome e senha são obrigatórios');
      return;
    }
    const data = { name, domain: domain || guessDomain(name), username, password, category, favorite, description };
    if (entry) {
      updateEntry(entry.id, data);
      toast.success('Senha atualizada!');
    } else {
      addEntry(data);
      toast.success('Senha salva!');
    }
    onClose();
  };

  const selectPreset = (preset: typeof presetServices[0]) => {
    setName(preset.name);
    setDomain(preset.domain);
    setCategory(preset.category);
    setShowServicePicker(false);
  };

  const filteredPresets = presetServices.filter(s =>
    category === 'other' ? true : s.category === category
  );

  return (<>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl bg-card p-6 shadow-elevated sm:rounded-3xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-card-foreground">
            {entry ? 'Editar Senha' : 'Nova Senha'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Service picker toggle */}
        {!entry && (
          <button
            type="button"
            onClick={() => setShowServicePicker(!showServicePicker)}
            className="mb-4 flex w-full items-center justify-between rounded-xl bg-secondary p-3 text-sm text-secondary-foreground"
          >
            <span>Selecionar serviço pré-definido</span>
            <ChevronDown size={16} className={`transition-transform ${showServicePicker ? 'rotate-180' : ''}`} />
          </button>
        )}

        <AnimatePresence>
          {showServicePicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {filteredPresets.map(preset => (
                  <button
                    key={preset.domain}
                    type="button"
                    onClick={() => selectPreset(preset)}
                    className="flex flex-col items-center gap-1 rounded-xl p-3 transition-colors hover:bg-secondary"
                  >
                    <ServiceLogo domain={preset.domain} name={preset.name} size={32} />
                    <span className="text-xs text-card-foreground">{preset.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Logo preview */}
          <div className="flex items-end gap-3">
            <ServiceLogo domain={domain} name={name} size={48} />
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome do serviço</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); if (!entry) setDomain(''); }}
                placeholder="Ex: Netflix"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Domínio</label>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="Ex: netflix.com"
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Usuário / Email</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Password with generator */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border bg-background px-3 py-2.5 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="rounded-xl gradient-primary px-3 text-primary-foreground transition-opacity hover:opacity-90"
                title="Gerar senha aleatória"
              >
                <RefreshCw size={16} />
              </button>
              {/* Botão análise com IA */}
              <button
                type="button"
                onClick={() => setShowAIPanel(true)}
                className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-primary transition-colors hover:bg-primary/20"
                title="Analisar com IA"
              >
                <Sparkles size={16} />
              </button>
            </div>
            <div className="mt-2">
              <PasswordStrengthBar password={password} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição (Opcional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Adicione uma descrição, dica ou observação"
              rows={2}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {categories.filter(c => c.id !== 'favorites').map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    category === cat.id
                      ? 'gradient-primary text-primary-foreground shadow-glow'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl gradient-primary py-3 font-display font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-90"
          >
            {entry ? 'Salvar Alterações' : 'Adicionar Senha'}
          </button>
        </form>
      </motion.div>
    </motion.div>

    {/* Painel de análise com IA */}
    <AnimatePresence>
      {showAIPanel && (
        <AIAnalysisPanel
          password={password}
          onPasswordGenerated={(nova) => {
            setPassword(nova);
            setShowPassword(true);
          }}
          onClose={() => setShowAIPanel(false)}
        />
      )}
    </AnimatePresence>
  </>);
}
