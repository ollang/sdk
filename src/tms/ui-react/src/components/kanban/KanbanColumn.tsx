import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextCard } from './TextCard';
import { TranslatableText, KanbanColumn as KanbanColumnType } from '@/types';
import { Scan, Languages, CheckCircle2, Send } from 'lucide-react';

interface KanbanColumnProps {
  column: KanbanColumnType;
  texts: TranslatableText[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (status: TranslatableText['status'], selected: boolean) => void;
  onTranslateSelected: () => void;
  onApplyTranslations: () => void;
  isTranslating: boolean;
  isApplying: boolean;
  hasApiKey: boolean;
}

const iconMap = {
  scanned: Scan,
  translating: Languages,
  translated: CheckCircle2,
  submitted: Send,
};

export function KanbanColumn({
  column,
  texts,
  onToggleSelect,
  onSelectAll,
  onTranslateSelected,
  onApplyTranslations,
  isTranslating,
  isApplying,
  hasApiKey,
}: KanbanColumnProps) {
  const Icon = iconMap[column.status];
  const selectedCount = texts.filter((t) => t.selected).length;
  const allSelected = texts.length > 0 && selectedCount === texts.length;

  return (
    <div className="flex-1 min-w-[300px] max-w-[400px]">
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Icon className="h-5 w-5" style={{ color: column.color }} />
              {column.title}
            </CardTitle>
            <Badge variant="secondary">{texts.length}</Badge>
          </div>

          {texts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onSelectAll(column.status, checked as boolean)}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
                </span>
              </div>

              {column.status === 'scanned' && selectedCount > 0 && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={onTranslateSelected}
                  disabled={isTranslating || !hasApiKey}
                >
                  {isTranslating ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      Translating...
                    </>
                  ) : (
                    <>
                      <Languages className="h-3 w-3 mr-1" />
                      Translate Selected
                    </>
                  )}
                </Button>
              )}

              {column.status === 'translated' && selectedCount > 0 && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={onTranslateSelected}
                  disabled={isTranslating || !hasApiKey}
                >
                  {isTranslating ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      Translating...
                    </>
                  ) : (
                    <>
                      <Languages className="h-3 w-3 mr-1" />
                      Re-translate Selected (override)
                    </>
                  )}
                </Button>
              )}

              {column.status === 'translated' && selectedCount > 0 && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={onApplyTranslations}
                  disabled={isApplying || !hasApiKey}
                >
                  {isApplying ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      Applying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Apply Selected
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
            {texts.map((text) => (
              <TextCard key={text.id} text={text} onToggleSelect={onToggleSelect} />
            ))}
            {texts.length === 0 && (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No items
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
