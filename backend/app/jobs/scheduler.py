"""定时任务:每分钟检查一次有没有投票到期了要结算。

只有这一个任务,而且只做一件事 —— 调 settle_due_rounds。
所有规则都在 orchestrator 里,这里不写任何业务判断。

两种跑法:
  - 跟着后端一起跑(默认)。后端一启动它就在后台转,不用管。
  - 单独跑一次:python -m app.jobs.scheduler   —— 给 cron 用的
"""

from __future__ import annotations

import asyncio
import logging
import os

from ..db.session import SessionLocal
from ..domain.decisions.orchestrator import expire_due_proposals, settle_due_rounds
from ..domain.trips.service import sync_trip_statuses

log = logging.getLogger("tripsync.scheduler")

TICK_SECONDS = int(os.getenv("SETTLE_TICK_SECONDS", "60"))


def run_once() -> dict[str, list[str]]:
    """结算到期的投票 + 作废到期的确认。跑多少次都安全。"""
    with SessionLocal() as db:
        synced = sync_trip_statuses(db)
        settled = settle_due_rounds(db)
        expired = expire_due_proposals(db)
        db.commit()
    if synced:
        log.info("同步了 %d 趟旅行状态: %s", len(synced), synced)
    if settled:
        log.info("结算了 %d 轮投票: %s", len(settled), settled)
    if expired:
        log.info("作废了 %d 个过期提案: %s", len(expired), expired)
    return {"synced": synced, "settled": settled, "expired": expired}


async def _loop() -> None:
    while True:
        try:
            # 数据库是同步的,丢到线程里跑,不卡住接口
            await asyncio.to_thread(run_once)
        except Exception:
            # 一次失败不能让定时任务死掉,下一分钟继续
            log.exception("结算这一轮出错了,一分钟后重试")
        await asyncio.sleep(TICK_SECONDS)


def start(app) -> asyncio.Task:
    """挂到 FastAPI 上,后端一起来它就开始转。"""
    task = asyncio.create_task(_loop())
    app.state.settle_task = task
    return task


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("这一轮:", run_once())
