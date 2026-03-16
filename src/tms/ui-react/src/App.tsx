import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { TranslatableText, Config } from './types';

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [texts, setTexts] = useState<TranslatableText[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingScans, setIsLoadingScans] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showFolderNameDialog, setShowFolderNameDialog] = useState(false);
  const [showStrapiDialog, setShowStrapiDialog] = useState(false);
  const [strapiUrl, setStrapiUrl] = useState('');
  const [strapiToken, setStrapiToken] = useState('');
  const [pendingApplyTexts, setPendingApplyTexts] = useState<TranslatableText[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState(
    () => sessionStorage.getItem('ollang-api-key') || ''
  );
  const [folderName, setFolderName] = useState('');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [folders, setFolders] = useState<Array<{ id: string; name: string; isCms?: boolean }>>([]);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState('tr');
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  useEffect(() => {
    if (savedApiKey) {
      sessionStorage.setItem('ollang-api-key', savedApiKey);
    } else {
      sessionStorage.removeItem('ollang-api-key');
    }
  }, [savedApiKey]);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config?.hasApiKey) {
      loadFolders();
    }
  }, [config?.hasApiKey]);

  useEffect(() => {
    const loadFolderScans = async () => {
      if (!selectedFolderFilter) return;

      setIsLoadingScans(true);
      try {
        const response = await fetch(
          `/api/scans?folderName=${encodeURIComponent(selectedFolderFilter)}`,
          { headers: apiHeaders() }
        );
        const data = await response.json();

        if (data.success && data.scans) {
          const allTexts: TranslatableText[] = [];
          for (const scan of data.scans) {
            if (!scan.scanData) continue;
            const folderName = scan.scanData.folderName || 'Unknown';

            if (scan.scanData.texts) {
              const textsWithStatus = scan.scanData.texts.map((t: TranslatableText) => ({
                ...t,
                status: t.status || 'scanned',
                selected: false,
                folderName,
              }));
              allTexts.push(...textsWithStatus);
            }

            if (scan.scanData.media && Array.isArray(scan.scanData.media)) {
              const mediaItems: TranslatableText[] = scan.scanData.media.map((m: any) => ({
                id: m.id,
                text: m.alt || m.mediaUrl,
                type: m.type || 'cms-media',
                source: m.source || {
                  file: m.metadata?.selector || 'cms-media',
                  line: 0,
                  column: 0,
                },
                selected: false,
                status: m.status || 'scanned',
                translations: {},
                category: m.mediaType || 'image',
                folderName,
                mediaUrl: m.mediaUrl,
                mediaType: m.mediaType,
                alt: m.alt,
                isMedia: true,
              }));
              allTexts.push(...mediaItems);
            }
          }

          setTexts(allTexts);
          updateLastScanTime(data.scans, selectedFolderFilter);
        }
      } catch (error) {
      } finally {
        setIsLoadingScans(false);
      }
    };

    if (selectedFolderFilter) {
      loadFolderScans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderFilter, savedApiKey]);

  const apiHeaders = (extra?: Record<string, string>): Record<string, string> => {
    const headers: Record<string, string> = { ...extra };
    if (savedApiKey) {
      headers['x-api-key'] = savedApiKey;
    }
    return headers;
  };

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig(data);

      if (!data.hasApiKey) {
        setShowApiKeyDialog(true);
      }
    } catch (error) {
    }
  };

  const loadFolders = async () => {
    try {
      setIsLoadingScans(true);

      const response = await fetch('/api/folders', { headers: apiHeaders() });
      const data = await response.json();

      if (data.success && data.folders) {
        setFolders(data.folders);

        if (!selectedFolderFilter && data.folders.length > 0) {
          setSelectedFolderFilter(data.folders[0].name);
        }

        if (data.folders.length === 0) {
          setShowFolderNameDialog(true);
        }
      }
    } catch (error) {
    } finally {
      setIsLoadingScans(false);
    }
  };

  const updateLastScanTime = (scans: any[], folderName: string) => {
    if (!folderName || !scans || scans.length === 0) {
      setLastScanTime(null);
      return;
    }

    const folderScans = scans.filter((scan) => scan.scanData?.folderName === folderName);

    if (folderScans.length > 0 && folderScans[0].scanData?.timestamp) {
      setLastScanTime(folderScans[0].scanData.timestamp);
    } else {
      setLastScanTime(null);
    }
  };

  const handleScan = async () => {
    if (!config?.hasApiKey) {
      setShowApiKeyDialog(true);
      return;
    }

    if (!selectedFolderFilter) {
      setShowFolderNameDialog(true);
      return;
    }

    setIsScanning(true);
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ folderName: selectedFolderFilter }),
      });
      const data = await response.json();

      if (data.success) {
        const newTexts = data.texts.map((t: TranslatableText) => ({
          ...t,
          selected: false,
          folderName: selectedFolderFilter,
        }));
        setTexts(newTexts);
        setLastScanTime(data.lastScanTime);
      }
    } catch (error) {
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreateNewFolder = async () => {
    if (!folderName.trim()) {
      return;
    }

    setShowFolderNameDialog(false);

    const newFolderName = folderName.trim();
    setSelectedFolderFilter(newFolderName);
    setFolderName('');

    setIsScanning(true);
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ folderName: newFolderName }),
      });
      const data = await response.json();

      if (data.success) {
        const newTexts = data.texts.map((t: TranslatableText) => ({
          ...t,
          selected: false,
          folderName: newFolderName,
        }));
        setTexts(newTexts);
        setLastScanTime(data.lastScanTime);

        await loadFolders();
      }
    } catch (error) {
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;

    try {
      setApiKeyError(null);
      setIsSavingApiKey(true);

      const response = await fetch('/api/config/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSavedApiKey(apiKey);
        setShowApiKeyDialog(false);
        setApiKey('');
        loadConfig();
      } else {
        setApiKeyError(
          data.error || 'Failed to validate API key. Please check your token and try again.'
        );
      }
    } catch (error) {
      setApiKeyError('Could not reach Ollang local server. Please try again.');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleRemoveApiKey = () => {
    setShowApiKeyDialog(true);
  };

  const handleToggleSelect = (id: string) => {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)));
  };

  const handleSelectAll = (status: TranslatableText['status'], selected: boolean) => {
    setTexts((prev) => prev.map((t) => (t.status === status ? { ...t, selected } : t)));
  };

  const startPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        if (!selectedFolderFilter) {
          return;
        }

        const url = `/api/scans?folderName=${encodeURIComponent(selectedFolderFilter)}`;
        const response = await fetch(url, { headers: apiHeaders() });
        const data = await response.json();

        if (data.success && data.scans && data.scans.length > 0) {
          const latestScan = data.scans[0];
          if (latestScan.scanData && latestScan.scanData.texts) {
            setTexts((prevTexts) => {
              const prevTextsMap = new Map(prevTexts.map((t) => [t.id, t]));

              return latestScan.scanData.texts.map((t: TranslatableText) => {
                const prevText = prevTextsMap.get(t.id);
                const shouldClearSelection =
                  prevText?.status === 'translating' && t.status === 'translated';
                return {
                  ...t,
                  status: t.status || 'scanned',
                  selected: shouldClearSelection ? false : prevText?.selected || false,
                  folderName: prevText?.folderName || latestScan.scanData.folderName || 'Unknown',
                };
              });
            });

            const hasTranslating = latestScan.scanData.texts.some(
              (t: TranslatableText) => t.status === 'translating'
            );

            if (!hasTranslating) {
              clearInterval(pollInterval);
              setIsTranslating(false);
            }
          }
        }
      } catch (error) {
      }
    }, 10000);

    setTimeout(() => {
      clearInterval(pollInterval);
      setIsTranslating(false);
    }, 300000);
  };

  const handleTranslateSelected = async () => {
    if (!config?.hasApiKey) {
      setShowApiKeyDialog(true);
      return;
    }

    const selected = texts.filter(
      (t) => t.selected && t.status !== 'translating' && t.status !== 'submitted'
    );
    if (selected.length === 0) return;

    setIsTranslating(true);

    setTexts((prev) =>
      prev.map((t) =>
        t.selected && t.status !== 'translating' && t.status !== 'submitted'
          ? { ...t, status: 'translating' }
          : t
      )
    );

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          textIds: selected.map((t) => t.id),
          targetLanguage,
          folderName: selectedFolderFilter,
        }),
      });

      const data = await response.json();
      if (data.success) {
        startPolling();
      }
    } catch (error) {
      setTexts((prev) =>
        prev.map((t) => (selected.find((s) => s.id === t.id) ? { ...t, status: 'scanned' } : t))
      );
      setIsTranslating(false);
    }
  };

  const handleApplyTranslations = async () => {
    if (!config?.hasApiKey) {
      setShowApiKeyDialog(true);
      return;
    }

    const translated = texts.filter((t) => t.selected && t.status === 'translated');
    if (translated.length === 0) return;

    const isCms = !!folders.find((f) => f.name === selectedFolderFilter)?.isCms;

    if (isCms && !strapiUrl && !strapiToken) {
      setPendingApplyTexts(translated);
      setShowStrapiDialog(true);
      return;
    }

    await executeApply(translated);
  };

  const executeApply = async (translated: TranslatableText[]) => {
    setIsApplying(true);

    const isCms = !!folders.find((f) => f.name === selectedFolderFilter)?.isCms;

    try {
      const body: Record<string, any> = {
        targetLanguage,
        textIds: translated.map((t) => t.id),
        folderName: selectedFolderFilter,
      };

      if (isCms && strapiUrl && strapiToken) {
        body.strapiUrl = strapiUrl;
        body.strapiToken = strapiToken;
      }

      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        const updatedTexts = texts.map((t) => {
          if (t.selected && t.status === 'translated') {
            const statusByLanguage = {
              ...(t.statusByLanguage || {}),
              [targetLanguage]: 'submitted' as const,
            };
            return {
              ...t,
              status: 'submitted' as const,
              statusByLanguage,
              selected: false,
            };
          }
          return t;
        });

        setTexts(updatedTexts);
      }
    } catch (error) {
    } finally {
      setIsApplying(false);
    }
  };

  const handleStrapiSubmit = async () => {
    if (!strapiUrl.trim() || !strapiToken.trim()) return;
    setShowStrapiDialog(false);
    await executeApply(pendingApplyTexts);
    setPendingApplyTexts([]);
  };

  const isAuthRequired = config ? !config.hasApiKey : false;

  return (
    <div className="min-h-screen bg-background relative">
      <Header
        config={config}
        onScan={handleScan}
        isScanning={isScanning}
        onShowApiKeyDialog={() => setShowApiKeyDialog(true)}
        onRemoveApiKey={handleRemoveApiKey}
        lastScanTime={lastScanTime}
        onConfigUpdate={loadConfig}
        folders={folders}
        selectedFolder={selectedFolderFilter}
        onFolderChange={setSelectedFolderFilter}
        onCreateNewFolder={() => setShowFolderNameDialog(true)}
        isCmsFolder={!!folders.find((f) => f.name === selectedFolderFilter)?.isCms}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={setTargetLanguage}
        apiHeaders={apiHeaders}
      />

      <main
        className={`container mx-auto px-4 py-6 ${
          isAuthRequired ? 'pointer-events-none blur-sm' : ''
        }`}
      >
        {isLoadingScans ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading previous scans...</p>
            </div>
          </div>
        ) : texts.length === 0 ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">No texts scanned yet</h2>
              <p className="text-muted-foreground mb-4">
                {folders.find((f) => f.name === selectedFolderFilter)?.isCms
                  ? 'This is a CMS folder. Push content from the browser extension.'
                  : 'Click "Scan Project" to get started'}
              </p>
            </div>
          </div>
        ) : (
          <KanbanBoard
            texts={texts
              .filter((t) => (t as any).folderName === selectedFolderFilter)
              .map((t) => {
                const byLang = (t as any).statusByLanguage || {};
                const langStatus = byLang[targetLanguage];

                let status: TranslatableText['status'];
                if (
                  langStatus === 'translating' ||
                  langStatus === 'translated' ||
                  langStatus === 'submitted'
                ) {
                  status = langStatus;
                } else if (t.translations && t.translations[targetLanguage]) {
                  status = 'translated';
                } else {
                  status = 'scanned';
                }

                return { ...t, status };
              })}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onTranslateSelected={handleTranslateSelected}
            onApplyTranslations={handleApplyTranslations}
            isTranslating={isTranslating}
            isApplying={isApplying}
            hasApiKey={config?.hasApiKey || false}
          />
        )}
      </main>

      {isAuthRequired && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 text-center">
            <h2 className="text-xl font-semibold mb-2">Ollang API Key Required</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Please enter a valid Ollang API key to use the dashboard.
            </p>
            <Button onClick={() => setShowApiKeyDialog(true)}>Enter API Key</Button>
          </div>
        </div>
      )}

      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Ollang API Key {config?.hasApiKey ? 'Management' : 'Required'}
            </DialogTitle>
            <DialogDescription>
              {config?.hasApiKey
                ? 'Your Ollang API key is currently set. Enter a new key to update it.'
                : 'Please enter your Ollang API key to use translation features.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {config?.hasApiKey && (
              <div className="mb-4 p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">Current API Key: ***************</p>
              </div>
            )}
            <Input
              type="password"
              placeholder="Enter your API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
            />
            {apiKeyError && <p className="mt-2 text-sm text-destructive">{apiKeyError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKey} disabled={isSavingApiKey || !apiKey.trim()}>
              {isSavingApiKey ? 'Validating...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFolderNameDialog} onOpenChange={setShowFolderNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for your new translation project folder. A scan will be performed to
              initialize the folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Folder Name</label>
            <Input
              type="text"
              placeholder="e.g., My Website Translation"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNewFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderNameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewFolder} disabled={!folderName.trim()}>
              Create & Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showStrapiDialog}
        onOpenChange={(open) => {
          setShowStrapiDialog(open);
          if (!open) {
            setPendingApplyTexts([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Strapi CMS Credentials</DialogTitle>
            <DialogDescription>
              Enter your Strapi URL and API token to push translations to your CMS.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Strapi URL</label>
              <Input
                type="url"
                placeholder="https://your-strapi.com"
                value={strapiUrl}
                onChange={(e) => setStrapiUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Base URL of your Strapi instance (e.g. https://cms.ollang.com)
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">API Token</label>
              <Input
                type="password"
                placeholder="Enter your Strapi API token..."
                value={strapiToken}
                onChange={(e) => setStrapiToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStrapiSubmit()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Full-access API token from Strapi Settings &rarr; API Tokens
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStrapiDialog(false);
                setPendingApplyTexts([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStrapiSubmit}
              disabled={!strapiUrl.trim() || !strapiToken.trim()}
            >
              Submit to Strapi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
