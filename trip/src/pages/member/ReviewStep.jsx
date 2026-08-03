import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, Badge, Button, Banner } from '../../components/primitives'
import PlanSectionCard from '../../components/PlanSectionCard'
import ReviewPanel from '../../components/ReviewPanel'
import StepStatus from '../../components/StepStatus'
import DemoSwitch from '../../components/DemoSwitch'
import LogicNote from '../../components/LogicNote'
import { useTrips } from '../../context/TripContext'
import { PLAN_SECTIONS, CHANGE_SUMMARY } from '../../data/seed'
import s from '../../layouts/AppLayout.module.css'

/**
 * B3/B4 · 计划书审核（成员）
 * 两种模式：
 *   full        首次看某版 —— 全部部分展开，30 秒–3 分钟
 *   incremental 新版本发布 —— 变化聚焦：摘要置顶 → 只展开改动 → 其余一键沿用，≈30 秒
 *
 * 增量模式是收敛机制的核心：让每一轮比上一轮更便宜。
 */
export default function ReviewStep() {
  const { trip } = useOutletContext()
  const { advance } = useTrips()
  const navigate = useNavigate()
  const [mode, setMode] = useState('full')
  const [keptRest, setKeptRest] = useState(false)

  const incremental = mode === 'incremental'
  const changedIds = ['day3', 'transport']          // v3 中被修改的部分
  const shown = incremental ? PLAN_SECTIONS.filter(x => changedIds.includes(x.id)) : PLAN_SECTIONS

  const submit = () => {
    advance(trip.id, 'member', 'confirm')
    navigate(`/member/trip/${trip.id}/confirm`)
  }

  return (
    <>
      <StepStatus lines={trip.member.lines} />
      <DemoSwitch
        value={mode} onChange={setMode}
        options={[
          { value: 'full', label: '首次审核 v2（全量）' },
          { value: 'incremental', label: '新版本 v3（增量 ≈30s）' },
        ]}
      />

      {/* 与本人相关的冲突必须透出；他人信息一律匿名聚合 */}
      {!incremental && (
        <Banner tone="warn">
          One of <b>your</b> confirmed conditions conflicts with the current plan. <a>See the section →</a>
          <div className="small muted">只透出与你本人条件相关的冲突；他人信息一律匿名聚合。</div>
        </Banner>
      )}

      {incremental && (
        <>
          <Banner tone="info">
            Your previous acceptance is marked <b>Expired (v2)</b> because a new version was published.
            Only {changedIds.length} sections changed.
          </Banner>
          <Card variant="emphasis">
            <h3>📝 What changed in v3</h3>
            <ul className="small">
              <li><b>Changed:</b> {CHANGE_SUMMARY.v3.changed}</li>
              <li><b>Kept:</b> {CHANGE_SUMMARY.v3.kept}</li>
              <li><b>Impact:</b> {CHANGE_SUMMARY.v3.impact}</li>
            </ul>
            <Button variant="primary" disabled={keptRest} onClick={() => setKeptRest(true)}>
              {keptRest
                ? `✓ Kept for ${PLAN_SECTIONS.length - changedIds.length} sections`
                : `Keep my acceptance for the rest (${PLAN_SECTIONS.length - changedIds.length} sections)`}
            </Button>
          </Card>
        </>
      )}

      <div className={s.grid}>
        <div>
          {incremental && (
            <Card>
              <h3>Your conditions</h3>
              <p className="small">“≤$180/night hotel” — <Badge tone="ok">Satisfied ✓</Badge></p>
              <p className="small">
                “hotel with a pool” — <Badge tone="neutral">Skipped by organizer</Badge><br />
                <span className="muted">
                  Reason (required and shown to you): “No pool options within the group budget.”
                </span>
              </p>
            </Card>
          )}

          {shown.map(section => (
            <PlanSectionCard
              key={section.id}
              section={section}
              version="v2"
              compromise={section.memberCompromise}
            />
          ))}
        </div>

        <div>
          <Card>
            <h3>My status</h3>
            <p className="small">
              {incremental
                ? 'v2 acceptance expired · 2 changes waiting on you.'
                : "You haven't submitted your review for v2 yet."}
            </p>
            <hr />
            <p className="small muted">
              Round {trip.round} · {trip.deadline}<br />
              Not responding = abstain: doesn't count as accept, doesn't block, your hard constraints still apply.
            </p>
          </Card>
          <Card>
            <h3>My satisfaction over time</h3>
            <p className="small">v1 · 5 → v2 · 7</p>
            <p className="small muted">匿名，只有分布进入全组视图；可选公开自己的分数。</p>
          </Card>
        </div>
      </div>

      <ReviewPanel version={incremental ? 'v3' : 'v2'} sections={shown} onSubmit={submit} />

      <LogicNote title="② Review the plan 逻辑">
        <p>· 全量模式（首次看某版）30 秒–3 分钟；增量模式（新版本）默认变化聚焦：摘要置顶 → 只展开改动 → 其余一键沿用 ≈30 秒。</p>
        <p>· 满意度与接受分离：满意度随时可改（喂排序引擎），接受状态用于锁定判断。条件必填、Reject 必须指认部分。</p>
        <p>· 新版本发布 → 旧接受弱化为「已失效(vN)」；被组织者跳过的条件必须显示理由（决策4）。</p>
        <p>· 状态漂移：新版本到达时顶部横幅 + 刷新按钮，保留已填未提交内容，提交时服务端二次校验。</p>
      </LogicNote>
    </>
  )
}
