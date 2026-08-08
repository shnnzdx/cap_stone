import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, Badge, Button, Banner, Avatar, MemberRow } from '../../components/primitives'
import { Chip } from '../../components/primitives'
import AiNote from '../../components/AiNote'
import ReviewPanel from '../../components/ReviewPanel'
import LogicNote from '../../components/LogicNote'
import { useTrips } from '../../context/TripContext'
import { TEAM_REVIEW, FEEDBACK_BY_SECTION, PLAN_SECTIONS, MEMBERS } from '../../data/seed'
import s from '../../layouts/AppLayout.module.css'

/**
 * A5 内嵌的审核聚合视图（组织者）。
 * 与 ③ Plan 同属一轮循环，拆成独立阶段页是为了让二级栏能表达 ③⇄④ 的往返。
 */
export default function ReviewStage() {
  const { trip } = useOutletContext()
  const { advance } = useTrips()
  const navigate = useNavigate()

  const nameOf = id => MEMBERS.find(m => m.id === id)?.name ?? id
  const initialOf = id => MEMBERS.find(m => m.id === id)?.initial ?? '?'

  const goLock = () => {
    advance(trip.id, 'organizer', 'lock')
    navigate(`/organizer/trip/${trip.id}/lock`)
  }

  return (
    <>
      <div className={s.grid}>
        <div>
          <Card>
            <h3>Team review · {TEAM_REVIEW.responded} of {TEAM_REVIEW.total} responded · Round {trip.round}</h3>
            {TEAM_REVIEW.rows.map(row => (
              <MemberRow key={row.member}>
                <Avatar initial={initialOf(row.member)} />
                {nameOf(row.member)}
                {row.member === 'emma' && <span className="muted small">(you)</span>}
                <span className="spacer" />
                <Badge tone={row.tone}>{row.label}</Badge>
              </MemberRow>
            ))}
            <hr />
            <div className="row">
              <Button>Remind pending members</Button>
              <span className="small muted">
                未表态者到期记弃权：不算接受、不阻塞，其硬约束仍有效。
              </span>
            </div>
          </Card>

          <Card>
            <h3>Satisfaction (anonymous)</h3>
            <p className="small">
              min <b>{TEAM_REVIEW.satisfaction.min}</b> · avg <b>{TEAM_REVIEW.satisfaction.avg}</b> —
              全组只见分布；成员可自选公开分数；AI 见全量（决策6）。
              「最低满意度优先」排序引擎按 min 值决定下一轮先照顾谁。
            </p>
          </Card>

          <Card>
            <h3>Feedback aggregated by section</h3>
            {FEEDBACK_BY_SECTION.map(group => (
              <div key={group.section}>
                <p className="small"><b>{group.section}</b></p>
                <div>{group.chips.map(c => <Chip key={c}>{c}</Chip>)}</div>
                {group.conflict && (
                  <Banner tone="warn">
                    <span className="small">⚠ {group.conflict}</span>
                    <AiNote>{group.aiCompromise}</AiNote>
                  </Banner>
                )}
              </div>
            ))}
          </Card>

          <Card>
            <div className="row">
              <div className={s.spacer} style={{ flex: 1 }}>
                <b>Final vote</b>
                <p className="small muted">
                  Stop iterating — ask everyone for one last accept/reject on the current version.
                  替代硬轮次上限的闸门（决策14）。
                </p>
              </div>
              <Button>Start final vote</Button>
            </div>
          </Card>

          <div className="row">
            <Button onClick={() => navigate(`/organizer/trip/${trip.id}/plan`)}>
              ← Back to ③ Plan (apply the proposal → v3)
            </Button>
            <Button variant="primary" onClick={goLock}>Acceptance reached → ⑤ Lock</Button>
          </div>
        </div>

        <div>
          <Card>
            <h3>Why two separate controls</h3>
            <p className="small muted">
              满意度随时可改，喂排序引擎；接受状态用于锁定判断。
              一个人可以"不满意但接受"，也可以"满意但有条件" —— 合成一个控件就会丢掉这个信息。
            </p>
          </Card>
          <Card>
            <h3>Version handover</h3>
            <p className="small muted">
              新版本发布 → 旧接受状态批量弱化为「已失效(vN)」+ 顶部横幅提示重新审核。
            </p>
          </Card>
        </div>
      </div>

      {/* 组织者也要表态，接受算一票（决策1） */}
      <ReviewPanel
        version={trip.version ?? 'v2'}
        sections={PLAN_SECTIONS}
        onSubmit={goLock}
      />

      <LogicNote title="④ Review 逻辑">
        <p>· ③⇄④ 循环无固定上限。聚合触发：全员已反馈 / 截止 / 组织者手动推进。</p>
        <p>· 收敛靠成本递减：增量再审核 · 条件必填 · 修改预案卡 · 部分冻结 · 反馈聚合 · 轮次可见 + 疲劳提示 · 终局投票闸门。</p>
        <p>· 矛盾条件并置加警示，AI 提折中案并标注「无法同时满足 N 条」（决策5）。</p>
        <p>· 出口：达成锁定规则 → ⑤ Lock；未达成 → 回 ③ Plan 生成 vN+1。</p>
      </LogicNote>
    </>
  )
}
