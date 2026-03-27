import { Home, Grid3X3, Plus, Settings } from 'lucide-react';

type Tab = 'home' | 'categories' | 'add' | 'settings';

interface BottomNavProps {
  active: Tab;
  onNavigate: (tab: Tab) => void;
}

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  const tabs: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: 'Início' },
    { id: 'categories', icon: Grid3X3, label: 'Categorias' },
    { id: 'add', icon: Plus, label: 'Adicionar' },
    { id: 'settings', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isAdd = tab.id === 'add';
          const isActive = active === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 transition-all ${
                isAdd
                  ? 'gradient-primary -mt-5 rounded-2xl p-3 text-primary-foreground shadow-glow'
                  : isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={isAdd ? 24 : 20} />
              {!isAdd && <span className="text-[10px] font-medium" translate="no">{tab.label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
