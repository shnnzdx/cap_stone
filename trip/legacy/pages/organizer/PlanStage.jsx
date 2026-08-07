import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, Badge, Button, Banner } from '../../components/primitives'
import PlanSectionCard from '../../components/PlanSectionCard'
import AiNote from '../../components/AiNote'
import DemoSwitch from '../../components/DemoSwitch'
import LogicNote from '../../components/LogicNote'
import { PLAN_SECTIONS, CHANGE_SUMMARY, MODIFICATION_PROPOSAL } from '../../data/seed'
import s from '../../layouts/AppLayout.module.css'
import v from './PlanStage.module.css'

/**
 * A5 · 计划书页（核心，约 60% 工作量）
 * 组成：版本条 + 修改摘要卡 + 计划部分卡纵向排列 + 右侧栏（硬约束检查/费用/轮次）
 *      + 组织者专属的修改预案卡
 *
 * 三种版本态：当前版 / 回看历史版（只读）/ 生成失败（保留上一版，不静默覆盖）
 */
export default function PlanStage() {
  const { trip } = useOutletContext()
  const navigate = useNavigate()
  const [demo, setDemo] = useState('current')   // current | history | failed
  const [proposal, setProposal] = useState(MODIFICATION_PROPOSAL.map(p => ({ ...p, checked: true })))

  const version = demo === 'history' ? 'v1' : 'v2'
  const readOnly = demo === 'history'
  const summary = CHANGE_SUMMARY.v2

  const toggleProposal = i =>
    setProposal(prev => prev.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))

  return (
    <>
      <DemoSwitch
        value={demo} onChange={setDemo}
        options={[
          { value: 'current', label: '当前版 v2' },
          { value: 'history', label: '回看 v1（只读）' },
          { value: 'failed', label: 'v3 生成失败' },
        ]}
      />

      {/* ── 版本条 ── */}
      <div className={v.versionBar}>
        {['v1', 'v2'].map(ver => (
          <button
            key={ver} type="button"
            className={`${v.pill} ${version === ver ? v.pillCurrent : ''}`}
            onClick={() => setDemo(ver === 'v1' ? 'history' : 'current')}
          >
            {ver}{ver === 'v2' ? ' · current' : ''}
          </button>
        ))}
        <a className="small">View change summary</a>
      </div>

      {demo === 'failed' && (
        <Banner tone="danger">
          <b>Plan v3 generation failed</b> (model timeout). v2 is untouched and remains the current version.{' '}
          <Button>Retry generation</Button>
        </Banner>
      )}

      {readOnly && (
        <Banner tone="warn">
          Viewing <b>v1 (history, read-only)</b>.{' '}
          <Button onClick={() => setDemo('current')}>Back to current version (v2)</Button>
        </Banner>
      )}

      {/* ── 修改摘要卡（v2 起置顶醒目） ── */}
      {!readOnly && (
        <Card variant="emphasis">
          <h3>📝 What changed in v2</h3>
          <ul className="small">
            <li><b>Kept:</b> {summary.kept}</li>
            <li><b>Changed:</b> {summary.changed}</li>
            <li><b>Why:</b> {summary.why}</li>
            <li><b>Requests resolved:</b> {summary.resolved}</li>
            <li><b>Impact:</b> {summary.impact}</li>
          </ul>
        </Card>
      )}

      <div className={s.grid}>
        <div>
          {PLAN_SECTIONS.map(section => (
            <PlanSectionCard key={section.id} section={section} version={version} readOnly={readOnly} />
          ))}

          {/* ── 组织者专属：修改预案卡（AI 不直接改，先预告） ── */}
          {!readOnly && (
            <Card variant="dashed">
              <h3>🛠 Modification proposal <Badge tone="neutral">organizer only</Badge></h3>
              <AiNote>
                Based on this round's feedback I plan to change the following in v3.
                Nothing else will be touched. Frozen sections are excluded.
              </AiNote>
              {proposal.map((p, i) => (
                <label key={p.section} className="small" style={{ display: 'block' }}>
                  <input type="checkbox" checked={p.checked} onChange={() => toggleProposal(i)} />{' '}
                  <b>{p.section}</b> — {p.basis} · impact {p.impact}
                </label>
              ))}
              <p className="small muted">
                Won't touch: Overview, Accommodation, Day 1 (frozen ❄), Day 2. Cost recalculates automatically.
              </p>
              <div className="row">
                <Button variant="primary" disabled={!proposal.some(p => p.checked)}>
                  Apply selected → generate v3
                </Button>
                <details>
                  <summary className="small" style={{ cursor: 'pointer', color: 'var(--c-danger)' }}>Cancel all</summary>
                  <textarea rows={2} placeholder="Reason (required — shown to the members who raised these conditions)" />
                  <Button variant="danger">Confirm cancel</Button>
                </details>
              </div>
            </Card>
          )}
        </div>

        {/* ── 右侧栏 ── */}
        <div>
          <Card>
            <h3>Hard constraint check</h3>
            {readOnly
              ? <p className="small"><Badge tone="danger">1 violation 🔒</Badge> budget ceiling exceeded → locking disabled</p>
              : <p className="small"><Badge tone="ok">All pass ✓</Badge> budget · dates · destination · mobility</p>}
          </Card>
          <Card>
            <h3>Cost</h3>
            <p className="small">
              {readOnly ? <><b>$1,585</b>/person · over the $1,500 cap ✗</> : <><b>$1,420</b>/person · under the $1,500 cap ✓</>}
            </p>
          </Card>
          <Card>
            <h3>Round {trip.round}</h3>
            <p className="small">
              ③⇄④ 无固定上限，靠成本递减收敛。第 3 轮起提示：“已改 3 轮，考虑直接定案？”
            </p>
            <Button onClick={() => navigate(`/organizer/trip/${trip.id}/review`)}>Go to ④ Review →</Button>
          </Card>
          <Card>
            <p className="small muted">
              What-if panel（organizer only）— 最后实施，W4 未完成则以截图入答辩 PPT（决策13）。
            </p>
          </Card>
        </div>
      </div>

      <LogicNote title="③ Plan 逻辑（核心页）">
        <p>· 计划书 = 计划部分卡的纵向排列。每卡必备：可信度标签（四种可区分）+ 状态徽章（五种可区分）+ AI 解释行 + 反馈入口。</p>
        <p>· 版本条：v1·v2 胶囊，当前版高亮；回看历史版为只读并显示返程横幅。</p>
        <p>· 生成失败 → 保留上一版 + 明确错误 + 重试，<b>不得静默覆盖</b>。</p>
        <p>· 修改预案卡：AI 不直接改，先列打算改什么 / 依据几条条件（不点名）/ 不动什么 / 预计影响；全部取消须填理由并展示给提条件者（决策4）。</p>
        <p>· 部分冻结：连续两版全员接受 → ❄，预案不得包含（例外：硬约束触发，解冻须在摘要显式说明）。</p>
      </LogicNote>
    </>
  )
}
