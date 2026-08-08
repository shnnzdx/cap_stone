import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, Button, Banner } from '../../components/primitives'
import DemoSwitch from '../../components/DemoSwitch'
import LogicNote from '../../components/LogicNote'
import { useTrips } from '../../context/TripContext'
import { DECISION_LOG } from '../../data/seed'
import s from '../../layouts/AppLayout.module.css'

/**
 * A6 · 计划页（锁定 + 执行期）
 *
 * 核心概念：锁定不是"让 AI 确定方案"，而是全组正式拍板同意某一版计划。
 * 锁定标志决策期结束、执行期开始，直到旅行结束日期为止。
 */
export default function LockStage() {
  const { trip } = useOutletContext()
  const { toggleArchive } = useTrips()
  const navigate = useNavigate()
  const [demo, setDemo] = useState(trip.id === 'nyc' || trip.id === 'boston' ? 'locked' : 'prelock')

  const checklist = [
    { ok: true, label: `Everyone has reviewed v2 (${trip.people}/${trip.people} — 0 abstained)` },
    { ok: true, label: 'No hard-constraint violations' },
    { ok: true, label: 'Budget check: $1,420 ≤ $1,500 cap' },
    { ok: true, label: 'Acceptance reached under lock rule: Unanimous' },
  ]
  const canLock = checklist.every(c => c.ok)

  return (
    <>
      <DemoSwitch
        value={demo} onChange={setDemo}
        options={[
          { value: 'prelock', label: '锁定前检查' },
          { value: 'locked', label: '执行期' },
          { value: 'ended', label: '已结束' },
        ]}
      />

      {demo === 'prelock' && (
        <Card>
          <h3>Lock checklist</h3>
          <p className="small muted">
            锁定 ≠ 让 AI 确定方案，而是全组正式拍板：决策期结束、执行期开始。
          </p>
          <ul className="small">
            {checklist.map(c => <li key={c.label}>{c.ok ? '✅' : '✗'} {c.label}</li>)}
          </ul>
          <p className="small muted">
            任一项未过 → 按钮禁用并明确指出缺项，例如
            「✗ 1 member hasn't reviewed — remind or wait for the deadline (abstention doesn't block)」。
          </p>
          <Button variant="primary" disabled={!canLock} onClick={() => setDemo('locked')}>
            🔒 Lock this plan
          </Button>
          <span className="small muted"> 锁定后邀请链接转只读，旅行进入执行期。</span>
        </Card>
      )}

      {demo === 'locked' && (
        <>
          <Banner tone="ok">
            <b>🔒 Locked · In execution</b> · {trip.version ?? 'v2.1'} · {trip.deadline} ·
            this is now the file everyone follows
          </Banner>
          <div className={s.grid}>
            <div>
              <Card>
                <h3>Plan (read-only)</h3>
                <p className="small">
                  🗺 Overview — Chicago Oct 10–12 · 4 people<br />
                  🏨 Hampton Inn River North · $172/night<br />
                  📅 Day 1 The Loop · Day 2 Museums + food (v2.1: dinner swapped to Giordano's, same price) · Day 3 Wicker Park<br />
                  💰 $1,420 / person
                </p>
                <Button>Export summary</Button>
              </Card>
              <Card>
                <h3>📜 Decision Log</h3>
                <ul className="small">
                  {DECISION_LOG.map(line => <li key={line}>{line}</li>)}
                  <li><a>Leave this trip</a> <span className="muted">（拍板败者出口 · 决策7）</span></li>
                </ul>
              </Card>
            </div>
            <div>
              <Card>
                <h3>Execution changes</h3>
                <p className="small">
                  <b>① No-impact</b>（同价位换餐厅、调整活动顺序）
                </p>
                <Button>Edit directly → v2.2</Button>
                <span className="small muted"> 全员通知，无需表态</span>
                <hr />
                <p className="small"><b>③ Structural</b>（改日期 / 目的地 / 成员构成 / 硬约束）</p>
                <Button variant="danger" onClick={() => navigate(`/organizer/trip/${trip.id}/review`)}>
                  Reopen negotiation
                </Button>
                <p className="small muted">
                  接受状态失效 → 回 ④ Review → 重新锁定为 v3。
                  ②档（有影响）MVP 归入③档；触碰硬约束/日期/目的地/成员构成 ⇒ 自动强制重开。
                  执行期变更不计入协商轮次。
                </p>
              </Card>
              <Card>
                <h3>Archive</h3>
                <p className="small muted">归档只影响列表可见性，与锁定正交、可逆（决策16）。</p>
                <Button onClick={() => toggleArchive(trip.id)}>
                  {trip.archived ? 'Unarchive' : 'Archive this trip'}
                </Button>
              </Card>
            </div>
          </div>
        </>
      )}

      {demo === 'ended' && (
        <>
          <Banner tone="info">
            <b>Trip ended</b> · the end date has passed · fully read-only
          </Banner>
          <Card>
            <p className="small muted">
              计划只读排版 + Decision Log 永久档案（同执行期视图，全部编辑入口移除）。
            </p>
          </Card>
        </>
      )}

      <LogicNote title="⑤ Lock 逻辑">
        <p>· 锁定前：四项检查全绿才可锁（全员反馈 / 无硬约束违反 / 预算检查 / 按锁定规则达成接受）。</p>
        <p>· 锁定后到旅行结束为执行期：①档组织者直接改（v2.x），③档强制重开协商（回 ④ Review，重新锁定为 v3）。</p>
        <p>· 锁定 vs 归档正交（决策16）：锁定=流程状态（系统），归档=列表可见性（用户，可逆）。</p>
        <p>· 过旅行结束日期 → 自动转「已结束」，真正只读。</p>
      </LogicNote>
    </>
  )
}
