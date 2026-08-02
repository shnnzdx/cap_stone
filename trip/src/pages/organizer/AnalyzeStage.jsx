import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, Badge, Button, Chip, Banner } from '../../components/primitives'
import AiNote from '../../components/AiNote'
import DemoSwitch from '../../components/DemoSwitch'
import LogicNote from '../../components/LogicNote'
import { useTrips } from '../../context/TripContext'

/**
 * A4 · 冲突分析
 * 作用：生成前把问题结构化 —— 这是最便宜的一轮（只花组织者一个人的时间），
 *      也是「无有效方案」的拦截闸门（不硬生成一份违约的 v1）。
 *
 * 权限修正（相对 v4 文档）：
 *   涉及成员私密硬约束的妥协，由 AI 私聊该成员本人三选一（调约束/提方案/退出），
 *   组织者无按钮、只见匿名结论（决策8）。组织者只能改自己创建时设为 Fixed 的字段。
 *   任何在本页做出的选择都写入 v1 解释行与 Decision Log，成员可在 ④ Review 推翻（防锚定）。
 */
export default function AnalyzeStage() {
  const { trip } = useOutletContext()
  const { advance } = useTrips()
  const navigate = useNavigate()
  const [demo, setDemo] = useState('unresolved')

  const goPlan = () => {
    advance(trip.id, 'organizer', 'plan')
    navigate(`/organizer/trip/${trip.id}/plan`)
  }

  return (
    <>
      <DemoSwitch
        value={demo} onChange={setDemo}
        options={[
          { value: 'unresolved', label: '硬冲突未解决' },
          { value: 'resolved', label: '已解决' },
          { value: 'novalid', label: '无有效方案' },
        ]}
      />

      <Card>
        <h3>✅ Shared preferences</h3>
        <Chip>Museums &amp; local culture</Chip>
        <Chip>Deep-dish food tour</Chip>
        <Chip>Mid-range hotel</Chip>
        <Chip>Relaxed mornings</Chip>
      </Card>

      <Card>
        <h3>
          🔒 Hard conflicts{' '}
          {demo === 'resolved'
            ? <Badge tone="ok">All resolved ✓</Badge>
            : <Badge tone="danger">1 unresolved</Badge>}
        </h3>

        {demo === 'unresolved' && (
          <>
            <p>
              A budget ceiling conflicts with the hotel tier most of the group prefers.{' '}
              <span className="small muted">(hard constraints are never attributed to a person)</span>
            </p>
            <AiNote>
              This one belongs to a member's private constraint, so I'm asking <b>them</b> to choose — not you.
              The group only sees the anonymous outcome. (决策8)
            </AiNote>
            <Card>
              <p className="small">
                ⏳ Private negotiation in progress with 1 anonymous member — options offered:
                adjust the constraint / propose an alternative / leave the trip.
              </p>
              <Button onClick={() => setDemo('resolved')}>（演示：成员已回复 → 冲突解除）</Button>
            </Card>
            <hr />
            <p className="small"><b>What you can decide yourself</b> — only the fields you set as Fixed at creation:</p>
            <div className="row">
              <Button onClick={() => setDemo('resolved')}>Relax “Duration: 3 days” → open</Button>
              <Button onClick={() => setDemo('resolved')}>Raise the shared activity budget</Button>
            </div>
          </>
        )}

        {demo === 'resolved' && (
          <p className="muted">
            Resolved: hotel tier lowered one level (member-chosen). No remaining hard conflicts.{' '}
            <span className="small">该选择写入 v1 的 AI 解释行与 Decision Log，成员可在 ④ Review 推翻。</span>
          </p>
        )}

        {demo === 'novalid' && (
          <>
            <Banner tone="danger"><b>No valid plan exists</b> under the current hard constraints.</Banner>
            <AiNote>
              I will not force-generate a plan. Binding constraints: budget ceiling × fixed dates × hotel-tier floor.
              Realistic directions: relax the duration to 2 days · allow a lower hotel tier · raise the activity budget.
            </AiNote>
            <div className="row">
              <Button onClick={() => setDemo('resolved')}>Relax duration</Button>
              <Button onClick={() => setDemo('resolved')}>Ask members to reconsider</Button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <h3>❓ Needs clarification</h3>
        <ul className="small">
          <li>One member's walking limit is unspecified — ✨ AI asked them privately.</li>
          <li>Missing: everyone's arrival time on Day 1.</li>
        </ul>
      </Card>

      <Card>
        <h3>🤝 Flexible items</h3>
        <Chip>Nightlife: 1 wants, others neutral</Chip>
        <Chip>Breakfast style</Chip>
        <Chip>Day-2 pacing</Chip>
      </Card>

      {demo === 'resolved' ? (
        <Button variant="primary" onClick={goPlan}>Generate plan → ③ Plan v1</Button>
      ) : (
        <>
          <Button variant="primary" disabled>Generate plan</Button>
          <span className="small muted"> Resolve hard conflicts first.</span>
        </>
      )}

      <LogicNote title="② Analyze 逻辑（含权限修正）">
        <p>· 作用：生成前看清问题、先解硬冲突。这是最便宜的一轮，只花组织者一人的时间。</p>
        <p>· 「无有效方案」→ AI 解释 + 2–3 个妥协方向，<b>不硬生成</b>。</p>
        <p>· <b>权限修正</b>：涉及成员私密硬约束的妥协由 AI 私聊该成员本人三选一，组织者无按钮、只见匿名结论；组织者只能改自己设为 Fixed 的字段。</p>
        <p>· 防锚定：本页的任何选择写入 v1 解释行与 Decision Log，成员可在 ④ Review 提条件推翻。</p>
        <p>· 无硬冲突且无待澄清项时本页可自动跳过，直接生成。</p>
      </LogicNote>
    </>
  )
}
