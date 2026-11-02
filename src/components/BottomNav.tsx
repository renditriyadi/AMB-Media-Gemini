import React from 'react';
import { PlaySquare, Layers, Workflow, MessageSquare, Clapperboard, Folder, Sliders, User } from 'lucide-react';
import { NavTab } from '../types';

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'generate' as NavTab, label: 'Generate', icon: PlaySquare },
    { id: 'history' as NavTab, label: 'History', icon: Folder },
    // { id: 'batch' as NavTab, label: 'Batch', icon: Layers }, // Disembunyikan sementara
    { id: 'chat' as NavTab, label: 'Chat', icon: MessageSquare },
    { id: 'canvas' as NavTab, label: 'Canvas', icon: Workflow },
    // { id: 'studio' as NavTab, label: 'Studio', icon: Clapperboard }, // Disembunyikan sementara
    { id: 'settings' as NavTab, label: 'Settings', icon: Sliders },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white/95 dark:bg-[#141418]/95 backdrop-blur-md border-t border-stone-200/80 dark:border-white/10 px-4 py-2 transition-colors duration-300">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-md transition-colors duration-100 outline-none select-none cursor-pointer ${
                isActive
                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
              }`}
            >
              <div className={`p-1 rounded-md transition-colors duration-100 ${isActive ? 'bg-amber-50 dark:bg-amber-500/15' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight font-sans-body">{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* iOS home indicator bar styling accent */}
      <div className="w-32 h-1 bg-stone-300 dark:bg-white/20 rounded-full mx-auto mt-1" />
    </nav>
  );
};
