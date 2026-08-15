"""判定引擎:给一个改动,回答它走哪条路。

这个模块是整个产品的核心,规则如下(从上往下,命中即停):

  ① 碰硬底线了吗?(已订 / 违反谁的 required / 超预算上限 / 超日期范围) → Confirm
  ② 这个时段定过了吗?(投票定过或全员确认过)                          → 重开轮
  ③ 有人碰过这个时段吗?                                            → 普通轮
  ④ 都不是                                                        → 直接改

三条纪律:
  - 不碰数据库、不发网络请求、不调 AI。给同样的输入永远给同样的输出。
  - 私密数据只进不出:返回值里只有 AnonymizedFinding。
  - 只有 required 的约束能把判定顶到 Confirm;flexible 的不改变结果。
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import NamedTuple

from .types import (
    AnonymizedFinding,
    Check,
    Classification,
    Constraint,
    ConstraintKind,
    Importance,
    ItemView,
    Path,
    ProposedChange,
    Settledness,
)

# 每种约束对应一句给全组看的安全说法。永远不带姓名,永远不带原文。
SAFE_TEXT = {
    ConstraintKind.TIME_WINDOW: "This time falls outside a required time window.",
    ConstraintKind.BUDGET_CEILING: "This would push the trip past a required budget ceiling.",
    ConstraintKind.DATE_RANGE: "This date falls outside a required availability window.",
    ConstraintKind.WALK_LIMIT: "This day would exceed a required walking limit.",
    ConstraintKind.DIETARY: "This place does not meet a required dietary need.",
    ConstraintKind.AVOID_TAG: "This is something a member has required to avoid.",
}


class _CheckSpec(NamedTuple):
    """一条判据的全部固定文案。顺序即判定顺序。"""

    id: str
    label: str
    private_note: str
    path: Path
    headline: str
    detail: str


# 判定顺序:命中的第一条决定走哪条路。硬底线永远排最前。
CHECK_SPECS = (
    _CheckSpec(
        id="booking",
        label="Confirmed booking on this item",
        private_note="",
        path=Path.CONFIRM,
        headline="This touches a confirmed booking",
        detail=(
            "A real reservation is attached to this item. Every affected member has "
            "to confirm before the Current Plan changes, and someone will need to "
            "cancel the existing booking."
        ),
    ),
    _CheckSpec(
        id="required",
        label="Required constraint of a member",
        private_note=(
            "One member has a required constraint here. Who they are and why stays "
            "private."
        ),
        path=Path.CONFIRM,
        headline="This breaks a required constraint",
        detail=(
            "At least one member has a required constraint that this change would "
            "violate. Who they are and why stays private."
        ),
    ),
    _CheckSpec(
        id="settled",
        label="This block was already settled by a group round",
        private_note="",
        path=Path.REOPEN_ROUND,
        headline="This block was already settled",
        detail=(
            "Reopening a settled block needs a written reason, and members who do "
            "not respond count as keeping the current decision."
        ),
    ),
    _CheckSpec(
        id="contested",
        label="Someone else already asked about this slot",
        private_note="",
        path=Path.ROUND,
        headline="Someone already has a different idea for this slot",
        detail=(
            "Rather than negotiating one-on-one, everyone weighs in at once and the "
            "slot is settled in a single round."
        ),
    ),
)


def violates(constraint: Constraint, change: ProposedChange) -> bool:
    """这条约束被这次改动违反了吗。纯粹比大小,没有任何模糊判断。"""
    after: ItemView = change.after
    params = constraint.params

    if constraint.kind is ConstraintKind.TIME_WINDOW:
        earliest = params.get("earliest_hour")
        latest = params.get("latest_hour")
        if earliest is not None and after.start_hour < earliest:
            return True
        return (
            latest is not None
            and after.end_hour is not None
            and after.end_hour > latest
        )

    if constraint.kind is ConstraintKind.BUDGET_CEILING:
        ceiling = params.get("max_total_per_person")
        return (
            ceiling is not None
            and change.trip_total_after is not None
            and change.trip_total_after > ceiling
        )

    if constraint.kind is ConstraintKind.DATE_RANGE:
        start, end = params.get("start"), params.get("end")
        if start is not None and after.day_date < start:
            return True
        return end is not None and after.day_date > end

    if constraint.kind is ConstraintKind.WALK_LIMIT:
        limit = params.get("max_km_per_day")
        return (
            limit is not None
            and change.day_walk_km_after is not None
            and change.day_walk_km_after > limit
        )

    if constraint.kind is ConstraintKind.DIETARY:
        if not after.is_meal:
            return False
        required_tags = set(params.get("required_tags", ()))
        return bool(required_tags) and not required_tags.issubset(after.dietary_tags)

    if constraint.kind is ConstraintKind.AVOID_TAG:
        avoided = set(params.get("tags", ()))
        return bool(avoided & set(after.tags))

    return False


def _collect_findings(
    constraints: Sequence[Constraint], change: ProposedChange
) -> tuple[AnonymizedFinding, ...]:
    """把命中的 required 约束按种类合并成脱敏结论。

    按种类合并而不是逐条列出,是为了不让输出泄露
    "被挡住的正好是那唯一一个填了这条的人"。
    """
    hit_by_kind: dict[ConstraintKind, set[str]] = {}
    for constraint in constraints:
        if constraint.importance is not Importance.REQUIRED:
            continue
        if violates(constraint, change):
            hit_by_kind.setdefault(constraint.kind, set()).add(constraint.membership_id)

    return tuple(
        AnonymizedFinding(
            code=kind.value.upper(),
            safe_text=SAFE_TEXT[kind],
            affected_count=len(members),
        )
        for kind, members in hit_by_kind.items()
    )


def affected_membership_ids(
    change: ProposedChange, constraints: Sequence[Constraint]
) -> frozenset[str]:
    """哪些成员的硬底线被这次改动碰到了。

    **返回值绝不能进 API 响应。** 它只给 orchestrator 用来决定"拉谁进确认对话" ——
    只有真的被碰到的人需要点头,不是全组。

    这个信息故意**不放进 Classification**:那个类型是要发给前端的,
    装不下身份才是隐私保证。要身份的人得专门调这个函数,而 api 层从来不调。
    """
    return frozenset(
        c.membership_id
        for c in constraints
        if c.importance is Importance.REQUIRED and violates(c, change)
    )


def classify(
    change: ProposedChange, constraints: Sequence[Constraint]
) -> Classification:
    """判定一次改动走哪条路。这是这个模块唯一对外的入口。"""

    settledness = change.before.settledness
    findings = _collect_findings(constraints, change)

    # 一个人的行程没有"小组"可以表决,自己跟自己也不存在抢时段。
    # member_count 为 None 时按有别人处理,保持原来的严格行为。
    solo_trip = change.member_count is not None and change.member_count <= 1
    touched_by_requester = (
        change.last_touched_by_membership_id is not None
        and change.last_touched_by_membership_id == change.requested_by_membership_id
    )

    hits = {
        "booking": settledness is Settledness.BOOKED,
        "required": bool(findings),
        "settled": settledness is Settledness.SETTLED and not solo_trip,
        "contested": (
            settledness is Settledness.TOUCHED
            and not solo_trip
            and not touched_by_requester
        ),
    }

    # 四条判据每次都全部返回,不只返回命中的那条 ——
    # 用户要看见的是"哪些检查过了、哪一条把我拦下来",不是只看到一个结论。
    checks = tuple(
        Check(
            id=spec.id,
            label=spec.label,
            hit=hits[spec.id],
            private_note=spec.private_note if hits[spec.id] else "",
        )
        for spec in CHECK_SPECS
    )

    for spec in CHECK_SPECS:
        if hits[spec.id]:
            return Classification(
                path=spec.path,
                headline=spec.headline,
                detail=spec.detail,
                checks=checks,
                findings=findings if spec.id == "required" else (),
            )

    return Classification(
        path=Path.NOTICE,
        headline="No conflict — this can apply now",
        detail=(
            "Nothing hard is affected and nobody else has asked about this slot. It "
            "applies immediately and the group just gets a notice."
        ),
        checks=checks,
    )
