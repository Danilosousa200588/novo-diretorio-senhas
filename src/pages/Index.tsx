import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield, Moon, Sun, Sparkles, Loader2 } from 'lucide-react';
import { usePasswords } from '@/context/PasswordContext';
import { Category, PasswordEntry } from '@/types/password';
import SearchBar from '@/components/SearchBar';
import PasswordCard from '@/components/PasswordCard';
import CategoryGrid from '@/components/CategoryGrid';
import PasswordForm from '@/components/PasswordForm';
import BottomNav from '@/components/BottomNav';
import { categories } from '@/data/presets';
import { chamarAnaliseGeral, type AnaliseGeral } from '@/services/aiClient';
import { useAuth } from '@/context/AuthContext';
import { useLock } from '@/context/LockContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button'; // Assuming Button component is from shadcn/ui or similar

type Tab = 'home' | 'categories' | 'add' | 'settings';

export default function Index() {
  const { entries, search, getByCategory, theme, toggleTheme } = usePasswords();
  const { user, logout, deleteAccount } = useAuth();
  const { lockVault, hasBiometricsEnabled, isBiometricsSupported, enableBiometrics, disableBiometrics } = useLock();
  const [tab, setTab] = useState<Tab>('home');
  const [query, setQuery] = useState('');
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formCategory, setFormCategory] = useState<Category | undefined>();
  const [formPreset, setFormPreset] = useState<{ name: string; domain: string } | undefined>();
  const [analiseGeral, setAnaliseGeral] = useState<AnaliseGeral | null>(null);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAnaliseGeral = async () => {
    if (entries.length === 0) {
      toast.error('Nenhuma senha para analisar.');
      return;
    }
    setLoadingAnalise(true);
    setAnaliseGeral(null);
    try {
      const resultado = await chamarAnaliseGeral(entries as PasswordEntry[]);
      setAnaliseGeral(resultado);
    } catch (err: unknown) {
      toast.error('Erro na análise: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setLoadingAnalise(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    const sucesso = await deleteAccount();
    if (sucesso) {
      toast.success("Sua conta e todos os dados foram apagados permanentemente.");
    } else {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const displayEntries = query
    ? search(query)
    : selectedCategory
    ? getByCategory(selectedCategory)
    : entries;

  const handleNav = (t: Tab) => {
    if (t === 'add') {
      setEditEntry(null);
      setFormCategory(selectedCategory || undefined);
      setShowForm(true);
    } else {
      setTab(t);
      if (t !== 'categories') setSelectedCategory(null);
    }
  };

  const handleEdit = (entry: PasswordEntry) => {
    setEditEntry(entry);
    setShowForm(true);
  };

  const handleCategorySelect = (cat: Category) => {
    setSelectedCategory(cat);
    setTab('home');
  };

  const selectedCatInfo = selectedCategory
    ? categories.find(c => c.id === selectedCategory)
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-glow">
              <Shield size={18} className="text-primary-foreground" />
            </div>
            <h1 className="font-display text-lg font-bold text-foreground">Vault</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4">
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {selectedCatInfo && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    ← Todas
                  </button>
                  <span className="text-sm font-semibold text-foreground">
                    {selectedCatInfo.icon} {selectedCatInfo.label}
                  </span>
                </div>
              )}

              <SearchBar
                value={query}
                onChange={setQuery}
                onSelectService={(service) => {
                  setEditEntry(null);
                  setFormCategory(service.category as Category);
                  setFormPreset({ name: service.name, domain: service.domain });
                  setShowForm(true);
                  setQuery('');
                }}
              />

              {displayEntries.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                    <Shield size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {query ? 'Nenhum resultado encontrado' : 'Nenhuma senha salva ainda'}
                  </p>
                  {!query && (
                    <button
                      onClick={() => handleNav('add')}
                      className="rounded-xl gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow"
                    >
                      Adicionar primeira senha
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayEntries.map(entry => (
                    <PasswordCard key={entry.id} entry={entry} onEdit={handleEdit} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h2 className="font-display text-lg font-bold text-foreground">Categorias</h2>
              <CategoryGrid onSelect={handleCategorySelect} />
            </motion.div>
          )}

          {tab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <h2 className="font-display text-lg font-bold text-foreground">Configurações</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-card">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">Tema</p>
                    <p className="text-xs text-muted-foreground">
                      {theme === 'dark' ? 'Escuro' : 'Claro'}
                    </p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="rounded-xl gradient-primary p-2 text-primary-foreground"
                  >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                </div>

                <div className="rounded-2xl bg-card p-4 shadow-card">
                  <p className="text-sm font-semibold text-card-foreground">Total de senhas</p>
                  <p className="font-display text-2xl font-bold text-primary">{entries.length}</p>
                </div>

                <div className="rounded-2xl bg-card p-4 shadow-card">
                  <p className="text-sm font-semibold text-card-foreground">Favoritas</p>
                  <p className="font-display text-2xl font-bold text-accent">
                    {entries.filter(e => e.favorite).length}
                  </p>
                </div>

                <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">Biometria / Passkeys</p>
                      <p className="text-xs text-muted-foreground">
                        {isBiometricsSupported ? 'Suportado no seu dispositivo' : 'Não suportado no seu dispositivo'}
                      </p>
                    </div>
                  </div>
                  {isBiometricsSupported && (
                    <button
                      onClick={hasBiometricsEnabled ? disableBiometrics : enableBiometrics}
                      className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${
                        hasBiometricsEnabled 
                          ? 'border border-destructive/30 bg-destructive/10 text-destructive' 
                          : 'gradient-primary text-primary-foreground shadow-glow'
                      }`}
                    >
                      {hasBiometricsEnabled ? 'Desativar Biometria' : 'Ativar Biometria'}
                    </button>
                  )}
                </div>

                <div className="rounded-2xl bg-card p-4 shadow-card">
                  <button
                    onClick={lockVault}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    <Shield size={16} /> Bloquear Cofre Agora
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-card">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">Conta Supabase</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {user?.email}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await logout();
                      toast.success('Desconectado');
                    }}
                    className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                  >
                    Sair
                  </button>
                </div>

                {/* Análise Geral com IA */}
                <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
                  <p className="text-sm font-semibold text-card-foreground">Análise de Segurança com IA</p>
                  <button
                    onClick={handleAnaliseGeral}
                    disabled={loadingAnalise}
                    className="flex w-full items-center justify-center gap-2 rounded-xl gradient-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {loadingAnalise ? (
                      <><Loader2 size={15} className="animate-spin" /> Analisando…</>
                    ) : (
                      <><Sparkles size={15} /> Analisar Cofre Completo</>
                    )}
                  </button>

                  {analiseGeral && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Nível geral:</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          analiseGeral.nivelGeral === 'excelente' ? 'bg-emerald-500/20 text-emerald-500'
                          : analiseGeral.nivelGeral === 'bom' ? 'bg-blue-500/20 text-blue-500'
                          : analiseGeral.nivelGeral === 'razoável' ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-red-500/20 text-red-500'
                        }`}>{analiseGeral.nivelGeral}</span>
                      </div>
                      {analiseGeral.qtdFracas > 0 && (
                        <p className="text-xs text-red-500">⚠️ {analiseGeral.qtdFracas} senha(s) fraca(s) detectada(s)</p>
                      )}
                      {analiseGeral.padroesInseguros.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Padrões inseguros:</p>
                          <ul className="space-y-0.5">
                            {analiseGeral.padroesInseguros.map((p, i) => (
                              <li key={i} className="text-xs text-card-foreground">• {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">💡 Recomendações:</p>
                        <ul className="space-y-0.5">
                          {analiseGeral.recomendacoes.map((r, i) => (
                            <li key={i} className="text-xs text-card-foreground">• {r}</li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="pt-8 text-center space-y-4">
                {!confirmDelete ? (
                  <Button 
                    variant="destructive" 
                    className="w-full mb-4" 
                    onClick={handleDeleteAccount}
                  >
                    Excluir Minha Conta Permanente
                  </Button>
                ) : (
                  <div className="space-y-2 mb-4 p-4 border border-destructive/50 rounded-xl bg-destructive/10">
                    <p className="text-xs font-bold text-destructive">
                      Você tem certeza? Essa ação é IRREVERSÍVEL!
                    </p>
                    <div className="flex gap-2 text-center items-center justify-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setConfirmDelete(false)}
                        disabled={isDeleting}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                        Sim, Excluir Tudo!
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Vault Password Manager v1.0
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav active={tab} onNavigate={handleNav} />

      <AnimatePresence>
        {showForm && (
           <PasswordForm
              entry={editEntry}
              presetCategory={formCategory}
              presetName={formPreset?.name}
              presetDomain={formPreset?.domain}
              onClose={() => { setShowForm(false); setEditEntry(null); setFormPreset(undefined); }}
            />
        )}
      </AnimatePresence>
    </div>
  );
}
