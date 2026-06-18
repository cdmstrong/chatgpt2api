from __future__ import annotations

import json
import logging
from threading import Thread
from typing import Any
from urllib import request, error as urllib_error

from services.config import config

logger = logging.getLogger(__name__)


class AIClient2APISyncService:
    """AIClient2API 同步服务 - 将 ChatGPT2API 账号同步到 AIClient2API 提供商池"""

    def __init__(self):
        self._sync_in_progress = False

    def _get_sync_settings(self) -> dict[str, Any]:
        return config.get_aiclient2api_sync_settings()

    def _is_sync_enabled(self) -> bool:
        settings = self._get_sync_settings()
        return bool(settings.get("enabled")) and bool(settings.get("base_url"))

    def _build_headers(self, settings: dict[str, Any]) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ChatGPT2API-Sync/1.0",
        }
        if settings.get("api_key"):
            headers["Authorization"] = f"Bearer {settings['api_key']}"
        return headers

    def sync_single_account(self, account: dict[str, Any], force: bool = False) -> bool:
        """同步单个账号到 AIClient2API

        Args:
            account: 账号数据
            force: 是否强制同步（即使状态不符合过滤条件）

        Returns:
            bool: 是否同步成功
        """
        if not self._is_sync_enabled():
            logger.debug("[AIClient2API Sync] Sync not enabled, skipping")
            return False

        settings = self._get_sync_settings()

        # 检查状态过滤
        filter_status = settings.get("filter_status")
        if filter_status and not force:
            account_status = account.get("status") or ""
            if account_status != filter_status:
                logger.info(f"[AIClient2API Sync] Skipping account {account.get('email', 'unknown')}: status {account_status} != {filter_status}")
                return False

        base_url = settings["base_url"]
        provider_type = settings["provider_type"]
        import_url = f"{base_url}/api/codex/import"

        # 准备请求数据
        payload = {
            "source": "api",
            "accounts": [account],
            "provider_type": provider_type,
            "skipExisting": True,
        }

        try:
            req = request.Request(
                import_url,
                data=json.dumps(payload).encode("utf-8"),
                headers=self._build_headers(settings),
                method="POST",
            )

            with request.urlopen(req, timeout=30) as response:
                response_data = json.loads(response.read().decode("utf-8"))
                imported = response_data.get("importedCount", 0)
                skipped = response_data.get("skippedCount", 0)

                logger.info(f"[AIClient2API Sync] Account synced: {account.get('email', 'unknown')}")
                logger.info(f"[AIClient2API Sync] Imported: {imported}, Skipped: {skipped}")
                return True

        except urllib_error.HTTPError as e:
            error_body = ""
            try:
                error_body = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            logger.error(f"[AIClient2API Sync] HTTP Error {e.code} syncing account {account.get('email', 'unknown')}: {error_body}")
            return False
        except urllib_error.URLError as e:
            logger.error(f"[AIClient2API Sync] Connection error: {e.reason}")
            return False
        except Exception as e:
            logger.error(f"[AIClient2API Sync] Unexpected error syncing account: {str(e)}")
            return False

    def sync_all_accounts(self) -> dict[str, Any]:
        """同步所有账号到 AIClient2API

        Returns:
            dict: 同步统计信息
        """
        if not self._is_sync_enabled():
            return {
                "success": False,
                "message": "Sync not enabled or base_url not configured",
                "synced_count": 0,
                "failed_count": 0,
                "total_count": 0,
            }

        from services.account_service import account_service

        settings = self._get_sync_settings()
        accounts = account_service.list_accounts()
        filter_status = settings.get("filter_status")

        # 应用过滤
        if filter_status:
            accounts = [a for a in accounts if a.get("status") == filter_status]

        logger.info(f"[AIClient2API Sync] Starting batch sync of {len(accounts)} accounts")

        synced_count = 0
        failed_count = 0

        for account in accounts:
            if self.sync_single_account(account, force=True):
                synced_count += 1
            else:
                failed_count += 1

        result = {
            "success": True,
            "message": f"Synced {synced_count}/{len(accounts)} accounts",
            "synced_count": synced_count,
            "failed_count": failed_count,
            "total_count": len(accounts),
        }

        logger.info(f"[AIClient2API Sync] Batch sync complete: {result}")
        return result

    def sync_single_account_async(self, account: dict[str, Any], force: bool = False) -> None:
        """异步同步单个账号（不阻塞主线程）"""
        if not self._is_sync_enabled():
            return

        settings = self._get_sync_settings()

        # 检查是否需要自动同步新账号
        if not force and not settings.get("auto_sync_new_accounts"):
            return

        # 后台线程执行同步
        def _sync():
            self.sync_single_account(account, force=force)

        Thread(target=_sync, daemon=True).start()

    def sync_account_on_refresh(self, account: dict[str, Any]) -> None:
        """Token 刷新后的同步"""
        if not self._is_sync_enabled():
            return

        settings = self._get_sync_settings()
        if not settings.get("sync_on_refresh"):
            return

        self.sync_single_account_async(account, force=True)

    def test_connection(self) -> dict[str, Any]:
        """测试与 AIClient2API 的连接

        Returns:
            dict: 测试结果
        """
        if not self._is_sync_enabled():
            return {
                "success": False,
                "message": "Sync not enabled or base_url not configured",
            }

        settings = self._get_sync_settings()
        status_url = f"{settings['base_url']}/api/codex/status"

        try:
            req = request.Request(
                status_url,
                headers=self._build_headers(settings),
                method="GET",
            )

            with request.urlopen(req, timeout=10) as response:
                response_data = json.loads(response.read().decode("utf-8"))
                return {
                    "success": True,
                    "message": "Connection successful",
                    "status_response": response_data,
                }

        except urllib_error.HTTPError as e:
            return {
                "success": False,
                "message": f"HTTP Error {e.code}: {e.reason}",
            }
        except urllib_error.URLError as e:
            return {
                "success": False,
                "message": f"Connection error: {e.reason}",
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unexpected error: {str(e)}",
            }


# 全局单例
sync_service = AIClient2APISyncService()
