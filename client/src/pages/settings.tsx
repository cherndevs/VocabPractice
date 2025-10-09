import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useVoices, VoiceInfo } from "@/hooks/use-voices";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";

const SELECTED_VOICES_KEY = 'selectedVoices';

function getSelectedVoices(): { en?: string; zh?: string } {
  try {
    return JSON.parse(localStorage.getItem(SELECTED_VOICES_KEY) || '{}');
  } catch {
    return {};
  }
}

function setSelectedVoices(sel: { en?: string; zh?: string }) {
  localStorage.setItem(SELECTED_VOICES_KEY, JSON.stringify(sel));
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<Partial<Settings>>({});
  const voices = useVoices();
  const [selectedVoices, setSelectedVoicesState] = useState<{ en?: string; zh?: string }>(getSelectedVoices());
  const [testingVoice, setTestingVoice] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<Settings>) => {
      const response = await apiRequest("PUT", "/api/settings", updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSettingChange = (key: keyof Settings, value: any) => {
    const updates = { [key]: value };
    setLocalSettings(prev => ({ ...prev, ...updates }));
    updateSettingsMutation.mutate(updates);
  };

  const currentSettings = { ...settings, ...localSettings };

  // Persist selected voices
  useEffect(() => {
    setSelectedVoices(selectedVoices);
  }, [selectedVoices]);

  // Test voice playback
  function testVoice(lang: 'en' | 'zh') {
    const voiceId = selectedVoices[lang];
    const phrase = lang === 'en' ? 'Hello world' : '你好';
    if (!('speechSynthesis' in window)) {
      toast({ title: 'SpeechSynthesis not available', variant: 'destructive' });
      return;
    }
    const synth = window.speechSynthesis;
    const voice = voices[lang].find(v => v.voiceURI === voiceId) || voices[lang][0];
    if (!voice) {
      toast({ title: `No ${lang === 'en' ? 'English' : 'Chinese'} voice available`, variant: 'destructive' });
      return;
    }
    const utter = new SpeechSynthesisUtterance(phrase);
    const actualVoice = synth.getVoices().find(v => v.voiceURI === voice.voiceURI) || null;
    utter.voice = actualVoice;
    utter.lang = voice.lang;
    utter.onend = () => setTestingVoice(null);
    setTestingVoice(voice.voiceURI);
    console.log('[TTS DEBUG] testVoice: utter.voice object:', actualVoice);
    synth.speak(utter);
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="px-4 py-6 bg-card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>

      </div>

      {/* Settings Content */}
      <div className="px-4 py-4 space-y-6">
        {/* TTS Voices Section */}
        <Card>
          <CardHeader>
            <CardTitle>Text-to-Speech Voices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* English Voice */}
              <div>
                <Label className="font-medium">English Voice</Label>
                <select
                  className="w-full mt-2 border rounded px-2 py-1"
                  value={selectedVoices.en || ''}
                  onChange={e => setSelectedVoicesState(v => ({ ...v, en: e.target.value }))}
                  disabled={!voices.ready || voices.en.length === 0}
                  data-testid="select-voice-en"
                >
                  <option value="">(Auto)</option>
                  {voices.en.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}){v.localService ? ' [local]' : ''}{v.default ? ' [default]' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="mt-2 px-3 py-1 bg-primary text-white rounded"
                  onClick={() => testVoice('en')}
                  disabled={!voices.ready || voices.en.length === 0 || !selectedVoices.en}
                  data-testid="test-voice-en"
                >Test voice</button>
                {selectedVoices.en && voices.ready && !voices.en.some(v => v.voiceURI === selectedVoices.en) && (
                  <div className="text-xs text-red-500 mt-2">Selected English voice is not available on this device. The closest available voice will be used.</div>
                )}
              </div>
              {/* Chinese Voice */}
              <div>
                <Label className="font-medium">Chinese Voice</Label>
                <select
                  className="w-full mt-2 border rounded px-2 py-1"
                  value={selectedVoices.zh || ''}
                  onChange={e => setSelectedVoicesState(v => ({ ...v, zh: e.target.value }))}
                  disabled={!voices.ready || voices.zh.length === 0}
                  data-testid="select-voice-zh"
                >
                  <option value="">(Auto)</option>
                  {voices.zh.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}){v.localService ? ' [local]' : ''}{v.default ? ' [default]' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="mt-2 px-3 py-1 bg-primary text-white rounded"
                  onClick={() => testVoice('zh')}
                  disabled={!voices.ready || voices.zh.length === 0 || !selectedVoices.zh}
                  data-testid="test-voice-zh"
                >Test voice</button>
                {selectedVoices.zh && voices.ready && !voices.zh.some(v => v.voiceURI === selectedVoices.zh) && (
                  <div className="text-xs text-red-500 mt-2">Selected Chinese voice is not available on this device. The closest available voice will be used.</div>
                )}
              </div>
            </div>
            {/* Refresh & Diagnostics */}
            <div className="flex items-center gap-4 mt-4">
              <button
                className="px-3 py-1 bg-secondary text-foreground rounded"
                onClick={() => voices.refresh()}
                disabled={!voices.ready}
                data-testid="refresh-voices"
              >Refresh voices</button>
              <span className="text-xs text-muted-foreground">
                {voices.ready ? `${voices.en.length} English, ${voices.zh.length} Chinese voices found.` : 'Loading voices...'}
              </span>
              {voices.ready && voices.zh.length === 0 && (
                <span className="text-xs text-red-500">No Chinese voices found. Install system voices for more options.</span>
              )}
            </div>
          </CardContent>
        </Card>
  {/* Playback Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Playback Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Word Repetitions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label className="font-medium">Word Repetitions</Label>
                  <p className="text-sm text-muted-foreground">
                    Adjust how many times a word is read aloud during practice.
                  </p>
                </div>
                <span className="text-foreground font-medium" data-testid="text-repetitions-value">
                  {currentSettings.wordRepetitions || 2}x
                </span>
              </div>
              <Slider
                value={[currentSettings.wordRepetitions || 2]}
                onValueChange={([value]) => handleSettingChange('wordRepetitions', value)}
                max={5}
                min={1}
                step={1}
                className="w-full"
                data-testid="slider-repetitions"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1x</span>
                <span>5x</span>
              </div>
            </div>

            {/* Pause Between Words */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label className="font-medium">Pause Between Words</Label>
                  <p className="text-sm text-muted-foreground">
                    Set the pause duration between repeated word readings.
                  </p>
                </div>
                <span className="text-foreground font-medium" data-testid="text-pause-value">
                  {((currentSettings.pauseBetweenWords || 1500) / 1000).toFixed(1)}s
                </span>
              </div>
              <Slider
                value={[(currentSettings.pauseBetweenWords || 1500) / 1000]}
                onValueChange={([value]) => handleSettingChange('pauseBetweenWords', Math.round(value * 1000))}
                max={5}
                min={0.5}
                step={0.5}
                className="w-full"
                data-testid="slider-pause"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0.5s</span>
                <span>5s</span>
              </div>
            </div>
          </CardContent>
        </Card>

  {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Notifications */}
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <Label className="font-medium">Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts for new sessions or progress updates.
                </p>
              </div>
              <Switch
                checked={currentSettings.notifications ?? true}
                onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
                data-testid="switch-notifications"
              />
            </div>

            {/* Dark Mode */}
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <Label className="font-medium">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Switch to a darker theme for reduced eye strain.
                </p>
              </div>
              <Switch
                checked={currentSettings.darkMode ?? false}
                onCheckedChange={(checked) => handleSettingChange('darkMode', checked)}
                data-testid="switch-dark-mode"
              />
            </div>

            {/* Data Synchronization */}
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <Label className="font-medium">Data Synchronization</Label>
                <p className="text-sm text-muted-foreground">
                  Sync your spelling sessions across devices.
                </p>
              </div>
              <Switch
                checked={currentSettings.dataSync ?? false}
                onCheckedChange={(checked) => handleSettingChange('dataSync', checked)}
                data-testid="switch-data-sync"
              />
            </div>

            {/* Pause Button */}
            <div className="flex items-center justify-between py-3">
              <div>
                <Label className="font-medium">Show Pause Button</Label>
                <p className="text-sm text-muted-foreground">
                  Display pause/resume button during test mode dictation.
                </p>
              </div>
              <Switch
                checked={currentSettings.enablePauseButton ?? true}
                onCheckedChange={(checked) => handleSettingChange('enablePauseButton', checked)}
                data-testid="switch-pause-button"
              />
            </div>
          </CardContent>
        </Card>

  {/* About */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">About Spelling Pro</Label>
                <p className="text-sm text-muted-foreground">
                  Version 1.0.0 - Built for efficient learning.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
