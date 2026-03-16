import { Button } from '@/components/ui/button';
import { Scan, Settings, Key } from 'lucide-react';
import { Config } from '@/types';
import { useState, useRef, useEffect } from 'react';
import OllangLogo from '@/assets/o-logo.svg';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HeaderProps {
  config: Config | null;
  onScan: () => void;
  isScanning: boolean;
  onShowApiKeyDialog: () => void;
  onRemoveApiKey: () => void;
  lastScanTime: string | null;
  onConfigUpdate: () => void;
  folders: Array<{ id: string; name: string; isCms?: boolean }>;
  selectedFolder: string;
  onFolderChange: (folder: string) => void;
  onCreateNewFolder: () => void;
  isCmsFolder: boolean;
  targetLanguages: string[];
  onTargetLanguagesChange: (langs: string[]) => void;
  apiHeaders?: (extra?: Record<string, string>) => Record<string, string>;
}

export function Header({
  config,
  onScan,
  isScanning,
  onShowApiKeyDialog,
  onRemoveApiKey,
  lastScanTime,
  onConfigUpdate,
  folders,
  selectedFolder,
  onFolderChange,
  onCreateNewFolder,
  isCmsFolder,
  targetLanguages: activeTargetLanguages,
  onTargetLanguagesChange,
  apiHeaders,
}: HeaderProps) {
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [videoTranslationType, setVideoTranslationType] = useState<'aiDubbing' | 'subtitle'>(
    'aiDubbing'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTargetLanguages, setSelectedTargetLanguages] = useState<string[]>([]);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
        setLangSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleActiveTargetLanguage = (value: string) => {
    const next = activeTargetLanguages.includes(value)
      ? activeTargetLanguages.filter((v) => v !== value)
      : [...activeTargetLanguages, value];
    onTargetLanguagesChange(next);
  };

  // Full language list copied from client dashboard AppConstants.languageAndFlagList
  const languageMap: { [key: string]: { title: string } } = {
    ab: { title: 'Abkhaz' },
    ace: { title: 'Acehnese' },
    ach: { title: 'Acholi' },
    af: { title: 'Afrikaans' },
    ak: { title: 'Twi (Akan)' },
    alz: { title: 'Alur' },
    am: { title: 'Amharic' },
    ar: { title: 'Arabic (MSA)' },
    'ar-AE': { title: 'Arabic (UAE)' },
    'ar-BH': { title: 'Arabic (Bahrain)' },
    'ar-DZ': { title: 'Arabic (Algeria)' },
    'ar-EG': { title: 'Arabic (Egypt)' },
    'ar-IQ': { title: 'Arabic (Iraq)' },
    'ar-JO': { title: 'Arabic (Jordan)' },
    'ar-KW': { title: 'Arabic (Kuwait)' },
    'ar-LB': { title: 'Arabic (Lebanon)' },
    'ar-LY': { title: 'Arabic (Libya)' },
    'ar-MA': { title: 'Arabic (Morocco)' },
    'ar-OM': { title: 'Arabic (Oman)' },
    'ar-PS': { title: 'Arabic (Palestine)' },
    'ar-QA': { title: 'Arabic (Qatar)' },
    'ar-SY': { title: 'Arabic (Syria)' },
    'ar-TN': { title: 'Arabic (Tunisia)' },
    'ar-YE': { title: 'Arabic (Yemen)' },
    as: { title: 'Assamese' },
    awa: { title: 'Awadhi' },
    ay: { title: 'Aymara' },
    az: { title: 'Azerbaijani' },
    ba: { title: 'Bashkir' },
    ban: { title: 'Balinese' },
    bbc: { title: 'Batak Toba' },
    be: { title: 'Belarusian' },
    bem: { title: 'Bemba' },
    bew: { title: 'Betawi' },
    bg: { title: 'Bulgarian' },
    bho: { title: 'Bhojpuri' },
    bik: { title: 'Bikol' },
    bm: { title: 'Bambara' },
    bn: { title: 'Bengali' },
    br: { title: 'Breton' },
    brx: { title: 'Bodo' },
    bs: { title: 'Bosnian' },
    bts: { title: 'Batak Simalungun' },
    btx: { title: 'Batak Karo' },
    bua: { title: 'Buryat' },
    ca: { title: 'Catalan' },
    ceb: { title: 'Cebuano' },
    cgg: { title: 'Kiga' },
    chm: { title: 'Meadow Mari' },
    ckb: { title: 'Kurdish (Sorani)' },
    cnh: { title: 'Hakha Chin' },
    co: { title: 'Corsican' },
    crh: { title: 'Crimean Tatar' },
    crs: { title: 'Seychellois Creole' },
    cs: { title: 'Czech' },
    cv: { title: 'Chuvash' },
    cy: { title: 'Welsh' },
    da: { title: 'Danish' },
    de: { title: 'German' },
    din: { title: 'Dinka' },
    doi: { title: 'Dogri' },
    dov: { title: 'Dombe' },
    dv: { title: 'Divehi' },
    dz: { title: 'Dzongkha' },
    ee: { title: 'Ewe' },
    el: { title: 'Greek' },
    en: { title: 'English' },
    'en-UK': { title: 'English (United Kingdom)' },
    eo: { title: 'Esperanto' },
    es: { title: 'Spanish (Spain)' },
    'es-MX': { title: 'Spanish (LATAM)' },
    et: { title: 'Estonian' },
    eu: { title: 'Basque' },
    fa: { title: 'Persian' },
    ff: { title: 'Fulfulde' },
    fi: { title: 'Finnish' },
    fj: { title: 'Fijian' },
    fr: { title: 'French' },
    'fr-CA': { title: 'French (Canadian)' },
    fy: { title: 'Frisian' },
    ga: { title: 'Irish' },
    gaa: { title: 'Ga' },
    gd: { title: 'Scots Gaelic' },
    ge: { title: 'Georgian' },
    gl: { title: 'Galician' },
    gn: { title: 'Guarani' },
    gu: { title: 'Gujarati' },
    ha: { title: 'Hausa' },
    haw: { title: 'Hawaiian' },
    he: { title: 'Hebrew' },
    hi: { title: 'Hindi' },
    hil: { title: 'Hiligaynon' },
    hmn: { title: 'Hmong' },
    hr: { title: 'Croatian' },
    hrx: { title: 'Hunsrik' },
    ht: { title: 'Haitian Creole' },
    hu: { title: 'Hungarian' },
    hy: { title: 'Armenian' },
    id: { title: 'Indonesian' },
    ig: { title: 'Igbo' },
    ilo: { title: 'Iloko' },
    is: { title: 'Icelandic' },
    it: { title: 'Italian' },
    ja: { title: 'Japanese' },
    jw: { title: 'Javanese' },
    kg: { title: 'Kyrgyz' },
    khm: { title: 'Khmer' },
    kk: { title: 'Kazakh' },
    kn: { title: 'Kannada' },
    ko: { title: 'Korean' },
    kok: { title: 'Konkani' },
    kri: { title: 'Krio' },
    ks: { title: 'Kashmiri' },
    ktu: { title: 'Kituba' },
    ku: { title: 'Kurdish (Kurmanji)' },
    la: { title: 'Latin' },
    lb: { title: 'Luxembourgish' },
    lg: { title: 'Ganda (Luganda)' },
    li: { title: 'Limburgan' },
    lij: { title: 'Ligurian' },
    lmo: { title: 'Lombard' },
    ln: { title: 'Lingala' },
    lo: { title: 'Lao' },
    lt: { title: 'Lithuanian' },
    ltg: { title: 'Latgalian' },
    luo: { title: 'Luo' },
    lus: { title: 'Mizo' },
    lv: { title: 'Latvian' },
    mai: { title: 'Maithili' },
    mak: { title: 'Makassar' },
    md: { title: 'Moldavian' },
    mg: { title: 'Malagasy' },
    mi: { title: 'Maori' },
    min: { title: 'Minang' },
    mk: { title: 'Macedonian' },
    ml: { title: 'Malayalam' },
    mn: { title: 'Mongolian' },
    mni: { title: 'Manipuri' },
    mr: { title: 'Marathi' },
    ms: { title: 'Malay' },
    'ms-Arab': { title: 'Malay (Jawi)' },
    mt: { title: 'Maltese' },
    my: { title: 'Burmese' },
    ne: { title: 'Nepali' },
    new: { title: 'Nepalbhasa (Newari)' },
    nl: { title: 'Dutch' },
    no: { title: 'Norwegian' },
    nr: { title: 'Ndebele (South)' },
    nso: { title: 'Northern Sotho (Sepedi)' },
    nus: { title: 'Nuer' },
    ny: { title: 'Chichewa (Nyanja)' },
    oc: { title: 'Occitan' },
    om: { title: 'Oromo' },
    or: { title: 'Odia (Oriya)' },
    pa: { title: 'Punjabi' },
    'pa-Arab': { title: 'Punjabi (Shahmukhi)' },
    pag: { title: 'Pangasinan' },
    pam: { title: 'Kapampangan' },
    pap: { title: 'Papiamento' },
    pl: { title: 'Polish' },
    ps: { title: 'Pashto' },
    pt: { title: 'Portuguese (Brazil)' },
    'pt-PT': { title: 'Portuguese (Portugal)' },
    qu: { title: 'Quechua' },
    rn: { title: 'Rundi' },
    ro: { title: 'Romanian' },
    rom: { title: 'Romani' },
    ru: { title: 'Russian' },
    rw: { title: 'Kinyarwanda' },
    sa: { title: 'Sanskrit' },
    sat: { title: 'Santali' },
    scn: { title: 'Sicilian' },
    sd: { title: 'Sindhi' },
    sg: { title: 'Sango' },
    'sg-ma': { title: 'Singaporean Mandarin' },
    'sg-ms': { title: 'Singaporean Malay' },
    shn: { title: 'Shan' },
    si: { title: 'Sinhala (Sinhalese)' },
    sk: { title: 'Slovak' },
    sl: { title: 'Slovenian' },
    sm: { title: 'Samoan' },
    sn: { title: 'Shona' },
    so: { title: 'Somali' },
    sq: { title: 'Albanian' },
    sr: { title: 'Serbian' },
    ss: { title: 'Swati' },
    st: { title: 'Sesotho' },
    su: { title: 'Sundanese' },
    sv: { title: 'Swedish' },
    sw: { title: 'Swahili' },
    szl: { title: 'Silesian' },
    'ta-IN': { title: 'Tamil' },
    te: { title: 'Telugu' },
    tet: { title: 'Tetum' },
    th: { title: 'Thai' },
    ti: { title: 'Tigrinya' },
    tj: { title: 'Tajik' },
    tk: { title: 'Turkmen' },
    tl: { title: 'Filipino' },
    tn: { title: 'Tswana' },
    tr: { title: 'Turkish' },
    ts: { title: 'Tsonga' },
    tt: { title: 'Tatar' },
    tw: { title: 'Akan (Twi)' },
    ug: { title: 'Uyghur' },
    uk: { title: 'Ukrainian' },
    ur: { title: 'Urdu' },
    'ur-LT': { title: 'Urdu Latin' },
    uz: { title: 'Uzbek' },
    vi: { title: 'Vietnamese' },
    xh: { title: 'Xhosa' },
    yi: { title: 'Yiddish' },
    yo: { title: 'Yoruba' },
    yua: { title: 'Yucatec Maya' },
    yue: { title: 'Cantonese' },
    zh: { title: 'Chinese (Simplified)' },
    'zh-Hant': { title: 'Chinese (Traditional)' },
    'zh-TW': { title: 'Chinese (Taiwan)' },
    zu: { title: 'Zulu' },
  };

  const languageOptions = Object.entries(languageMap).map(([value, cfg]) => ({
    value,
    label: cfg.title,
  }));

  const handleOpenSettings = () => {
    if (config) {
      setSourceLanguage(config.sourceLanguage);
      setSelectedTargetLanguages(config.targetLanguages || []);
      // Load video translation type from config if available
      setVideoTranslationType('aiDubbing'); // Default
    }
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const payload = {
        sourceLanguage: sourceLanguage.trim(),
        targetLanguages: selectedTargetLanguages,
        videoTranslationType,
      };

      const headers = apiHeaders
        ? apiHeaders({ 'Content-Type': 'application/json' })
        : { 'Content-Type': 'application/json' };

      const response = await fetch('/api/config/update', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setShowSettingsDialog(false);
        onConfigUpdate();
      }
    } catch (error) {
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTargetLanguage = (value: string) => {
    setSelectedTargetLanguages((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };
  const formatScanTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    // Format as date and time
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 space-y-3">
        {/* Row 1: only logo + name */}
        <div className="flex items-center ">
          <div className="flex items-center gap-3">
            <img src={OllangLogo} alt="Ollang logo" className="h-8 w-auto" />
            <h1 className="text-2xl font-bold">Ollang</h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Beta</span>
          </div>
        </div>

        {/* Row 2: folder, last scan, target language, API key, scan, settings */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {folders.length > 0 && (
              <div className="flex items-center gap-2 ml-6">
                <Label htmlFor="folder" className="text-sm font-medium whitespace-nowrap">
                  Folder:
                </Label>
                <Select value={selectedFolder} onValueChange={onFolderChange}>
                  <SelectTrigger id="folder" className="w-[200px]">
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.name}>
                        {folder.name}
                        {folder.isCms && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            CMS
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={onCreateNewFolder}>
                  + New
                </Button>
                <p className="text-sm text-muted-foreground mt-1">
                  {lastScanTime && (
                    <span className="ml-2">• Last scan: {formatScanTime(lastScanTime)}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {config?.targetLanguages && config.targetLanguages.length > 0 && (
              <div className="flex items-center gap-2 relative" ref={langDropdownRef}>
                <Label className="whitespace-nowrap">Target Languages</Label>
                <button
                  type="button"
                  disabled={!config.hasApiKey}
                  onClick={() => {
                    setLangDropdownOpen((o) => !o);
                    setLangSearch('');
                  }}
                  className="flex items-center gap-1 min-w-[180px] max-w-[320px] border rounded-md px-3 py-2 text-sm bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activeTargetLanguages.length === 0 ? (
                    <span className="text-muted-foreground">Select languages...</span>
                  ) : (
                    <span className="truncate">
                      {activeTargetLanguages.length} language{activeTargetLanguages.length !== 1 ? 's' : ''} selected
                    </span>
                  )}
                  <svg className="ml-auto h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                {langDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-[280px] rounded-md border bg-popover shadow-md">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search languages..."
                        value={langSearch}
                        onChange={(e) => setLangSearch(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[200px] overflow-auto p-1">
                      {languageOptions
                        .filter((opt) => config.targetLanguages.includes(opt.value))
                        .filter((opt) =>
                          langSearch
                            ? opt.label.toLowerCase().includes(langSearch.toLowerCase()) ||
                              opt.value.toLowerCase().includes(langSearch.toLowerCase())
                            : true
                        )
                        .map((opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={activeTargetLanguages.includes(opt.value)}
                              onChange={() => toggleActiveTargetLanguage(opt.value)}
                            />
                            <span>{opt.label}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{opt.value}</span>
                          </label>
                        ))}
                    </div>
                    {activeTargetLanguages.length > 0 && (
                      <div className="border-t p-2 flex gap-1 flex-wrap">
                        {activeTargetLanguages.map((val) => {
                          const lang = languageOptions.find((o) => o.value === val);
                          return (
                            <span
                              key={val}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
                            >
                              {lang?.label || val}
                              <button
                                type="button"
                                onClick={() => toggleActiveTargetLanguage(val)}
                                className="hover:text-destructive"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {config?.hasApiKey ? (
              <Button variant="outline" size="sm" onClick={onRemoveApiKey}>
                <Key className="h-4 w-4 mr-2" />
                API Key: ***
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onShowApiKeyDialog}>
                <Key className="h-4 w-4 mr-2" />
                Set API Key
              </Button>
            )}

            <Button
              onClick={onScan}
              disabled={isScanning || !config?.hasApiKey || isCmsFolder}
              title={
                isCmsFolder
                  ? 'Scan is not available for CMS folders. Content is pushed from the browser.'
                  : undefined
              }
            >
              <Scan className="h-4 w-4 mr-2" />
              {isScanning ? 'Scanning...' : isCmsFolder ? 'CMS Folder' : 'Scan Project'}
            </Button>
            <Button variant="outline" size="icon" onClick={handleOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
            <DialogDescription>
              Configure your translation project settings. Changes will be saved to ollang.config.ts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectRoot">Project Root</Label>
              <Input id="projectRoot" value={config?.projectRoot || ''} disabled />
              <p className="text-xs text-muted-foreground">
                The root directory of your project (read-only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceLanguage">Source Language</Label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger id="sourceLanguage">
                  <SelectValue placeholder="Select source language" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The base language of your project</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetLanguages">Target Languages</Label>
              <Select
                // Value is only used to keep Select controlled;
                // actual selection is managed with checkboxes.
                value={selectedTargetLanguages[0] || ''}
                onValueChange={() => {
                  // no-op: selection is managed with toggleTargetLanguage
                }}
              >
                <SelectTrigger id="targetLanguages">
                  <span className="truncate text-left">
                    {selectedTargetLanguages.length === 0
                      ? 'Select target languages'
                      : languageOptions
                          .filter((lang) => selectedTargetLanguages.includes(lang.value))
                          .map((lang) => lang.label)
                          .join(', ')}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 space-y-1 max-h-48 overflow-auto">
                    {languageOptions.map((lang) => (
                      <label
                        key={lang.value}
                        className="flex items-center space-x-2 rounded px-2 py-1 text-sm hover:bg-accent cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={selectedTargetLanguages.includes(lang.value)}
                          onChange={() => toggleTargetLanguage(lang.value)}
                        />
                        <span>{lang.label}</span>
                      </label>
                    ))}
                  </div>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select one or more target languages for translation
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoTranslationType">Video Translation Type</Label>
              <Select
                value={videoTranslationType}
                onValueChange={(value: 'aiDubbing' | 'subtitle') => setVideoTranslationType(value)}
              >
                <SelectTrigger id="videoTranslationType">
                  <SelectValue placeholder="Select translation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aiDubbing">AI Dubbing (Voice-over)</SelectItem>
                  <SelectItem value="subtitle">Subtitle</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how videos should be translated: AI Dubbing replaces audio, Subtitle adds
                text overlays
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
