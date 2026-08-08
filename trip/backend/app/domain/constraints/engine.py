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

from .types import (
    AnonymizedFinding,
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


def _violates(constraint: Constraint, change: ProposedChange) -> bool:
    """这条约束被这次改动违反了吗。纯粹比大小,没有任何模糊判断。"""
    after: ItemView = change.after
    params = constraint.params

    if constraint.kind is ConstraintKind.TIME_WINDOW:
        earliest = params.get("earliest_hour")
        latest = params.get("latest_hour")
        if earliest is not None and after.start_hour < earliest:
            return True
        return latest is not None and after.end_hour > latest

    if constraint.kind is ConstraintKind.BUDGET_CEILING:
        ceiling = params.get("max_total_per_person")
        return ceiling is not None and change.trip_total_after > ceiling

    if constraint.kind is ConstraintKind.DATE_RANGE:
        start, end = params.get("start"), params.get("end")
        if start is not None and after.day_date < start:
            return True
        return end is not None and after.day_date > end

    if constraint.kind is ConstraintKind.WALK_LIMIT:
        limit = params.get("max_km_per_day")
        return limit is not None and change.day_walk_km_after > limit

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
        if _violates(constraint, change):
            hit_by_kind.setdefault(constraint.kind, set()).add(constraint.membership_id)

    return tuple(
        AnonymizedFinding(
            code=kind.value.upper(),
            safe_text=SAFE_TEXT[kind],
            affected_count=len(members),
        )
        for kind, members in hit_by_kind.items()
    )


def classify(
    change: ProposedChange, constraints: Sequence[Constraint]
) -> Classification:
    """判定一次改动走哪条路。这是这个模块唯一对外的入口。"""

    if change.before.settledness is Settledness.BOOKED:
        return Classification(
            path=Path.CONFIRM,
            headline="This touches a confirmed booking",
            detail=(
                "A real reservation is attached to this item. Every affected member "
                "has to confirm before the Current Plan changes, and someone will "
                "need to cancel the existing booking."
            ),
        )

    findings = _collect_findings(constraints, change)
    if findings:
        return Classification(
            path=Path.CONFIRM,
            headline="This breaks a required constraint",
            detail=(
                "At least one member has a required constraint that this change would "
                "violate. Who they are and why stays private."
            ),
            findings=findings,
        )

    if change.before.settledness is Settledness.SETTLED:
        return Classification(
            path=Path.REOPEN_ROUND,
            headline="This block was already settled",
            detail=(
                "Reopening a settled block needs a written reason, and members who do "
                "not respond count as keeping the current decision."
            ),
        )

    if change.before.settledness is Settledness.TOUCHED:
        return Classification(
            path=Path.ROUND,
            headline="Someone already has a different idea for this slot",
            detail=(
                "Rather than negotiating one-on-one, everyone weighs in at once and "
                "the slot is settled in a single round."
            ),
        )

    return Classification(
        path=Path.NOTICE,
        headline="No conflict — this can apply now",
        detail=(
            "Nothing hard is affected and nobody else has asked about this slot. It "
            "applies immediately and the group just gets a notice."
        ),
    )
