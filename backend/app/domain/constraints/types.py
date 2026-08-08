"""判定引擎用到的全部数据形状。

这个文件有一条硬规则:凡是会被返回给外面的类型,
字段里一律不允许出现成员姓名、成员 id、或偏好原文。
私密数据只能进来(Constraint),不能出去(AnonymizedFinding)。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class Settledness(str, Enum):
    """一个时段有多结实。越往下越难推翻。"""

    LOOSE = "loose"        # AI 刚生成,没人碰过
    TOUCHED = "touched"    # 有人改过一次,直接生效了
    SETTLED = "settled"    # 投票结算过 / 全员确认过
    BOOKED = "booked"      # 真的付钱订了


class Path(str, Enum):
    """判定结果。界面上分别显示为 Notice / Round / Confirm。"""

    NOTICE = "notice"              # 直接改,只发匿名通知
    ROUND = "round"                # 普通投票轮
    REOPEN_ROUND = "reopen_round"  # 重开轮:要写理由,弃权算维持原样
    CONFIRM = "confirm"            # 相关成员逐个确认,全同意才生效


class ConstraintKind(str, Enum):
    """用户能填的六种约束。界面怎么收集可以随时改,存成这六种不能改。"""

    TIME_WINDOW = "time_window"        # {"earliest_hour": 9.0, "latest_hour": 22.0}
    BUDGET_CEILING = "budget_ceiling"  # {"max_total_per_person": 650.0}
    DATE_RANGE = "date_range"          # {"start": date, "end": date}
    WALK_LIMIT = "walk_limit"          # {"max_km_per_day": 3.0}
    DIETARY = "dietary"                # {"required_tags": ["vegetarian"]}
    AVOID_TAG = "avoid_tag"            # {"tags": ["nightlife"]}


class Importance(str, Enum):
    REQUIRED = "required"   # 绝对不行,违反就走 Confirm
    FLEXIBLE = "flexible"   # 尽量满足,违反了不改变判定结果


@dataclass(frozen=True)
class Constraint:
    """某个成员的一条约束。

    这个对象**只在引擎内部流转**,永远不出现在返回值里。
    membership_id 和 private_note 是判定需要但绝不能外泄的字段。
    """

    id: str
    membership_id: str
    kind: ConstraintKind
    importance: Importance
    params: dict
    private_note: str = ""


@dataclass(frozen=True)
class ItemView:
    """引擎判定一个行程条目时需要知道的全部信息。"""

    id: str
    day_date: date
    start_hour: float          # 14.5 表示 2:30 PM
    duration_min: int
    price_per_person: float
    tags: frozenset[str] = field(default_factory=frozenset)
    dietary_tags: frozenset[str] = field(default_factory=frozenset)
    is_meal: bool = False
    settledness: Settledness = Settledness.LOOSE

    @property
    def end_hour(self) -> float:
        return self.start_hour + self.duration_min / 60


@dataclass(frozen=True)
class ProposedChange:
    """一次待判定的改动。

    day_walk_km_after / trip_total_after 由调用方算好传进来,
    引擎自己不查数据库、不算路程——保持纯函数。
    """

    before: ItemView
    after: ItemView
    day_walk_km_after: float
    trip_total_after: float
    requested_by_membership_id: str


@dataclass(frozen=True)
class AnonymizedFinding:
    """判定命中的一条理由,已脱敏。

    注意这里**没有** membership_id,**没有**原文。
    这不是"记得过滤",是类型上就装不下。
    """

    code: str
    safe_text: str
    affected_count: int


@dataclass(frozen=True)
class Check:
    """一条判据,以及它有没有命中。

    四条判据**每次都全部返回**,不是只返回命中的那条 ——
    用户要看见的是"哪些检查过了、哪一条把我拦下来了",
    而不是只看到一个结论。这是"看得见为什么"的载体。

    private_note 是一句**固定文案**,永远不含任何用户填的内容。
    """

    id: str
    label: str
    hit: bool
    private_note: str = ""


@dataclass(frozen=True)
class Classification:
    """判定结果。这是引擎唯一的对外产物。"""

    path: Path
    headline: str
    detail: str
    checks: tuple[Check, ...] = ()
    findings: tuple[AnonymizedFinding, ...] = ()

    @property
    def needs_reason(self) -> bool:
        """重开轮必须让发起人写一句理由。"""
        return self.path is Path.REOPEN_ROUND
