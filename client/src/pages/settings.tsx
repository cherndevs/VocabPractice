import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<Partial<Settings>>({});

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

        {/* Tab Navigation */}
        <Tabs value="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sessions" asChild>
              <Link href="/sessions">Sessions</Link>
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Settings Content */}
      <div className="px-4 py-4 space-y-6">
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
            <div className="flex items-center justify-between py-3">
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
