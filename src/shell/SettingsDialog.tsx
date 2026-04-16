import { useState, useCallback } from "react";
import {
  Settings,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  useSettings,
  getModelsForProvider,
  PROVIDER_LABELS,
  PROVIDER_KEY_HINTS,
} from "./useSettings";
import { apiTestConnection } from "./api";
import type { AppSettings, Provider } from "./useSettings";

const CUSTOM_VALUE = "__custom__";

interface SettingsDialogProps {
  trigger?: React.ReactNode;
}

export function SettingsDialog({ trigger }: SettingsDialogProps = {}) {
  const { settings, updateSettings } = useSettings();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [open, setOpen] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testError, setTestError] = useState("");

  // Sync draft when dialog opens (§6.2 — user control: always start from saved state)
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(settings);
      const models = getModelsForProvider(settings.provider);
      setCustomModel(settings.model !== "" && !models.includes(settings.model));
      setTestStatus("idle");
      setTestError("");
    }
    setOpen(nextOpen);
  }

  const handleTestConnection = useCallback(async () => {
    setTestStatus("testing");
    setTestError("");
    try {
      const result = await apiTestConnection({
        provider: draft.provider,
        modelId: draft.model,
        ...(draft.baseUrl ? { baseUrl: draft.baseUrl } : {}),
        ...(draft.apiKey ? { apiKey: draft.apiKey } : {}),
      });
      if (result.ok) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        setTestError(result.error ?? "Unknown error");
      }
    } catch (err) {
      setTestStatus("error");
      setTestError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [draft]);

  const knownModels = getModelsForProvider(draft.provider);
  const selectModelValue = customModel
    ? CUSTOM_VALUE
    : draft.model || knownModels[0];

  // §6.4 — error prevention: validate before save
  const isModelEmpty = customModel && draft.model.trim() === "";
  const canSave = !isModelEmpty;

  const needsBaseUrl =
    draft.provider === "openai-compatible" || draft.provider === "openai";

  function handleProviderChange(provider: Provider) {
    const models = getModelsForProvider(provider);
    setCustomModel(false);
    setDraft((d) => ({
      ...d,
      provider,
      model: models.includes(d.model) ? d.model : models[0],
      baseUrl: "",
    }));
  }

  function handleModelSelectChange(v: string | null) {
    if (!v) return;
    if (v === CUSTOM_VALUE) {
      setCustomModel(true);
      setDraft((d) => ({ ...d, model: "" }));
    } else {
      setCustomModel(false);
      setDraft((d) => ({ ...d, model: v }));
    }
  }

  function handleSave() {
    if (!canSave) return;
    updateSettings({
      ...draft,
      maxTokens: Math.max(256, draft.maxTokens),
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
        >
          <Settings className="h-4 w-4" />
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your AI provider and credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Provider — §6.5: descriptive labels */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Provider</label>
            <Select
              value={draft.provider}
              onValueChange={(v) => v && handleProviderChange(v as Provider)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PROVIDER_LABELS) as [Provider, string][])
                  .sort(([, a], [, b]) => a.localeCompare(b))
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Model</label>
            <Select
              value={selectModelValue}
              onValueChange={handleModelSelectChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {knownModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={CUSTOM_VALUE}>Custom model ID…</SelectItem>
              </SelectContent>
            </Select>
            {customModel && (
              <div className="space-y-1">
                <Input
                  autoFocus
                  value={draft.model}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, model: e.target.value }))
                  }
                  placeholder="e.g. gpt-4o-2024-11-20"
                  aria-invalid={isModelEmpty || undefined}
                />
                {/* §6.8 — inline validation error */}
                {isModelEmpty && (
                  <p className="text-xs text-destructive">
                    Model ID cannot be empty.
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">API Key</label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={draft.apiKey}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, apiKey: e.target.value }))
                }
                placeholder={PROVIDER_KEY_HINTS[draft.provider]}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-10"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored in your browser only.
            </p>
          </div>

          {/* §6.6 — progressive disclosure: advanced settings */}
          {needsBaseUrl && (
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                Advanced
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Base URL</label>
                  <Input
                    value={draft.baseUrl}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, baseUrl: e.target.value }))
                    }
                    placeholder={
                      draft.provider === "openai-compatible"
                        ? "http://localhost:11434/v1"
                        : "https://api.openai.com/v1"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {draft.provider === "openai-compatible"
                      ? "Ollama: http://localhost:11434/v1 · LM Studio: http://localhost:1234/v1"
                      : "Leave empty for default. Override for Azure or proxies."}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* §6.6 — always show base URL for openai-compatible (it's required) */}
          {draft.provider === "openai-compatible" && !needsBaseUrl && null}

          <Separator />

          {/* Generation parameters */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Temperature</label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {draft.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[draft.temperature]}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    temperature: Array.isArray(v) ? v[0] : v,
                  }))
                }
                min={0}
                max={2}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground">
                Lower = more focused, higher = more creative.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max Tokens</label>
              <Input
                type="number"
                value={draft.maxTokens}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxTokens: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                min={256}
                max={128000}
              />
              <p className="text-xs text-muted-foreground">
                Maximum length of generated text per LLM call.
              </p>
            </div>
          </div>

          <Separator />

          {/* Connection test */}
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
            >
              {testStatus === "testing" && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              {testStatus === "success" && (
                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-green-600" />
              )}
              {testStatus === "error" && (
                <XCircle className="mr-2 h-3.5 w-3.5 text-destructive" />
              )}
              {testStatus === "testing"
                ? "Testing…"
                : testStatus === "success"
                  ? "Connection OK"
                  : testStatus === "error"
                    ? "Test Failed"
                    : "Test Connection"}
            </Button>
            {testStatus === "error" && testError && (
              <p className="text-xs text-destructive">{testError}</p>
            )}
          </div>

          {/* §6.4 — disable Save when invalid */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
