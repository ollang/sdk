import { KanbanColumn } from './KanbanColumn';
import { TranslatableText, KanbanColumn as KanbanColumnType } from '@/types';

interface KanbanBoardProps {
  texts: TranslatableText[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (status: TranslatableText['status'], selected: boolean) => void;
  onTranslateSelected: () => void;
  onApplyTranslations: () => void;
  isTranslating: boolean;
  isApplying: boolean;
  hasApiKey: boolean;
}

const columns: KanbanColumnType[] = [
  { id: 'scanned', title: 'Scanned', status: 'scanned', color: '#3b82f6', icon: 'scan' },
  {
    id: 'translating',
    title: 'Translating',
    status: 'translating',
    color: '#f59e0b',
    icon: 'languages',
  },
  { id: 'translated', title: 'Translated', status: 'translated', color: '#10b981', icon: 'check' },
  { id: 'submitted', title: 'Submitted', status: 'submitted', color: '#8b5cf6', icon: 'send' },
];

export function KanbanBoard({
  texts,
  onToggleSelect,
  onSelectAll,
  onTranslateSelected,
  onApplyTranslations,
  isTranslating,
  isApplying,
  hasApiKey,
}: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          texts={texts.filter((t) => t.status === column.status)}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          onTranslateSelected={onTranslateSelected}
          onApplyTranslations={onApplyTranslations}
          isTranslating={isTranslating}
          isApplying={isApplying}
          hasApiKey={hasApiKey}
        />
      ))}
    </div>
  );
}
