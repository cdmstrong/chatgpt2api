"use client";

import { useState } from "react";
import { ExternalLink, LoaderCircle, Save, TestTube, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useSettingsStore } from "../store";
import { testAIClient2APIConnection, syncAIClient2API } from "@/lib/api";

export function AIClient2APISettingsCard() {
  const config = useSettingsStore((state) => state.config);
  const isLoadingConfig = useSettingsStore((state) => state.isLoadingConfig);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const setAIClient2APIField = useSettingsStore((state) => state.setAIClient2APIField);
  const saveConfig = useSettingsStore((state) => state.saveConfig);

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  if (isLoadingConfig || !config?.aiclient2api_sync) {
    return (
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardContent className="flex items-center justify-center p-10">
          <LoaderCircle className="size-5 animate-spin text-stone-400" />
        </CardContent>
      </Card>
    );
  }

  const settings = config.aiclient2api_sync;

  const handleTestConnection = async () => {
    if (isTesting) return;
    setIsTesting(true);
    try {
      const result = await testAIClient2APIConnection();
      if (result.success) {
        toast.success("连接成功", { description: result.message });
      } else {
        toast.error("连接失败", { description: result.message });
      }
    } catch (error) {
      toast.error("连接测试失败", { description: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncAll = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncAIClient2API([], false);
      if (result.success) {
        toast.success("同步完成", {
          description: `成功同步 ${result.synced_count || 0} 个账号，失败 ${result.failed_count || 0} 个`,
        });
      } else {
        toast.error("同步失败", { description: result.message });
      }
    } catch (error) {
      toast.error("同步失败", { description: error instanceof Error ? error.message : "未知错误" });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <ExternalLink className="size-5 text-stone-500" />
              AIClient2API 自动同步
            </div>
            <p className="mt-1 text-xs leading-6 text-stone-500">
              账号注册、Token 刷新后自动同步到 AIClient2API 提供商池，无需手动导入。
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs ${settings.enabled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
            {settings.enabled ? "已启用" : "未启用"}
          </span>
        </div>

        <div className="space-y-5 rounded-xl border border-stone-200 bg-white px-4 py-4">
          <label className="flex items-center gap-3 text-sm text-stone-700">
            <Checkbox
              checked={Boolean(settings.enabled)}
              onCheckedChange={(checked) => setAIClient2APIField("enabled", Boolean(checked))}
            />
            启用自动同步
          </label>

          <div className="space-y-2">
            <Label className="text-sm text-stone-700">AIClient2API 地址</Label>
            <Input
              value={settings.base_url}
              onChange={(event) => setAIClient2APIField("base_url", event.target.value)}
              placeholder="http://localhost:3000"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-stone-700">API Key（可选）</Label>
            <Input
              value={settings.api_key}
              onChange={(event) => setAIClient2APIField("api_key", event.target.value)}
              placeholder="留空表示不需要认证"
              type="password"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-stone-700">目标提供商类型</Label>
            <Input
              value={settings.provider_type}
              onChange={(event) => setAIClient2APIField("provider_type", event.target.value)}
              placeholder="openai-codex-oauth"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 text-sm text-stone-700">
              <Checkbox
                checked={Boolean(settings.auto_sync_new_accounts)}
                onCheckedChange={(checked) => setAIClient2APIField("auto_sync_new_accounts", Boolean(checked))}
              />
              新账号注册成功后自动同步
            </label>

            <label className="flex items-center gap-3 text-sm text-stone-700">
              <Checkbox
                checked={Boolean(settings.sync_on_refresh)}
                onCheckedChange={(checked) => setAIClient2APIField("sync_on_refresh", Boolean(checked))}
              />
              Token 刷新后自动同步
            </label>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-stone-700">同步状态过滤（只同步指定状态的账号）</Label>
            <Input
              value={settings.filter_status}
              onChange={(event) => setAIClient2APIField("filter_status", event.target.value)}
              placeholder="正常"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            className="h-10 rounded-xl bg-stone-100 px-4 text-stone-700 hover:bg-stone-200"
            onClick={() => void handleTestConnection()}
            disabled={isTesting || !settings.enabled}
          >
            {isTesting ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <TestTube className="mr-2 size-4" />}
            测试连接
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-xl bg-stone-100 px-4 text-stone-700 hover:bg-stone-200"
            onClick={() => void handleSyncAll()}
            disabled={isSyncing || !settings.enabled}
          >
            {isSyncing ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            立即同步
          </Button>
          <Button
            className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
            onClick={() => void saveConfig()}
            disabled={isSavingConfig}
          >
            {isSavingConfig ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
