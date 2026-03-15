import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText } from 'lucide-react';
import { TranslatableText } from '@/types';

interface TextCardProps {
  text: TranslatableText;
  onToggleSelect?: (id: string) => void;
}

export function TextCard({ text, onToggleSelect }: TextCardProps) {
  const languages = Array.from(
    new Set([...Object.keys(text.statusByLanguage || {}), ...Object.keys(text.translations || {})])
  );

  const getLangColor = (lang: string) => {
    const st = text.statusByLanguage?.[lang];
    switch (st) {
      case 'submitted':
        return 'bg-purple-600 text-white';
      case 'translated':
        return 'bg-emerald-600 text-white';
      case 'translating':
        return 'bg-amber-500 text-white';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {onToggleSelect && (
              <Checkbox
                checked={text.selected}
                onCheckedChange={() => onToggleSelect(text.id)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{text.text}</p>
              {text.i18nKey && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {text.i18nKey}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            {text.category || text.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex space-x-2 items-center">
        {languages.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {languages.map((lang) => (
              <span
                key={lang}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getLangColor(lang)}`}
              >
                {lang.toUpperCase()}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground truncate">
          {text.strapiContentType && text.strapiEntryId
            ? `${text.strapiContentType}#${text.strapiEntryId}`
            : text.source.file.split('/').pop()}
        </p>
      </CardContent>
    </Card>
  );
}
