import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Chip } from '../../components/primitives'
import LogicNote from '../../components/LogicNote'
import s from '../../layouts/AppLayout.module.css'

/**
 * A2 · 创建旅行
 * 目标：最短路径产出一个可邀请的旅行。渐进披露 —— 首屏只要三个字段。
 *
 * Fixed / Open 开关决定下游行为：
 *   Fixed → 全组硬约束，带锁 chip，AI 不得违反、成员不可反对
 *   Open  → 仅作偏好收集的参考范围，分歧进 ② Analyze
 */
export default function CreateTripPage() {
  const navigate = useNavigate()
  const [created, setCreated] = useState(false)
  const [fixed, setFixed] = useState({ destination: true, dates: true, duration: false })

  const toggle = key => setFixed(f => ({ ...f, [key]: !f[key] }))

  const FixedSwitch = ({ field }) => (
    <span className={s.spacer}>
      <Button onClick={() => toggle(field)}>
        {fixed[field] ? 'Fixed 🔒' : 'Open to discussion'}
      </Button>
    </span>
  )

  if (created) {
    return (
      <div className={`${s.wrap} ${s.wrapNarrow}`}>
        <h2>Trip created 🎉</h2>
        <Card>
          <p><b>Share this invite link with your group:</b></p>
          <div className="row">
            <input type="text" readOnly value="https://tripsync.app/j/CHI-4F2K" style={{ maxWidth: 340 }} />
            <Button>Copy</Button>
          </div>
          <p className="small muted">Members don't need an account — the link is enough.</p>
        </Card>
        <Card>
          <b>Fixed conditions (hard constraints)</b>
          <div>
            {fixed.destination && <Chip locked>Destination: Chicago</Chip>}
            {fixed.dates && <Chip locked>Dates: Oct 10–12</Chip>}
            {!fixed.duration && <Chip>Duration: open to discussion</Chip>}
          </div>
        </Card>
        <Button variant="primary" onClick={() => navigate('/organizer/trip/chicago/collect')}>
          Go to ① Collect →
        </Button>
      </div>
    )
  }

  return (
    <div className={`${s.wrap} ${s.wrapNarrow}`}>
      <h2>Create a trip</h2>

      <Card>
        <h3>Basics</h3>
        <label className="small"><b>Trip name</b></label>
        <input type="text" defaultValue="Chicago Trip" />

        <div className="row" style={{ marginTop: 'var(--sp-3)' }}>
          <label className="small"><b>Destination</b></label>
          <FixedSwitch field="destination" />
        </div>
        <input type="text" defaultValue="Chicago, IL" />

        <div className="row" style={{ marginTop: 'var(--sp-3)' }}>
          <label className="small"><b>Dates</b></label>
          <FixedSwitch field="dates" />
        </div>
        <input type="text" defaultValue="Oct 10 – Oct 12, 2026" />

        <p className="small muted">
          <b>Fixed</b> → 全组硬约束，AI 不得违反、成员不可反对。<b>Open</b> → 仅作偏好收集参考，分歧进 ② Analyze。
        </p>
      </Card>

      <details>
        <summary style={{ cursor: 'pointer' }}><b>More details</b> <span className="muted small">(progressive disclosure)</span></summary>
        <Card>
          <div className="row">
            <label className="small"><b>Duration</b></label>
            <FixedSwitch field="duration" />
          </div>
          <input type="text" defaultValue="3 days" />
          <label className="small"><b>Party size</b></label>
          <input type="text" defaultValue="4" />
          <label className="small"><b>Currency</b></label>
          <select defaultValue="usd"><option value="usd">USD $</option><option value="eur">EUR €</option></select>
          <label className="small"><b>Other fixed conditions</b> <Chip locked>always Fixed</Chip></label>
          <textarea rows={2} placeholder="e.g. must fly out of O'Hare" />
        </Card>
      </details>

      <details>
        <summary style={{ cursor: 'pointer' }}><b>Advanced</b> <span className="muted small">(good defaults — you can skip)</span></summary>
        <Card>
          <label className="small"><b>Lock rule</b> — visible to members when they join</label>
          <select defaultValue="unanimous">
            <option value="unanimous">Unanimous — everyone accepts (default)</option>
            <option value="majority">Majority vote</option>
            <option value="organizer">Organizer decides</option>
          </select>
          <label className="small"><b>Stage deadline</b></label>
          <select defaultValue="48"><option value="48">48 hours (default)</option><option value="24">24 hours</option><option value="72">72 hours</option></select>
        </Card>
      </details>

      <Button variant="primary" onClick={() => setCreated(true)}>Create trip</Button>

      <LogicNote title="A2 · 创建旅行逻辑">
        <p>· 渐进披露：首屏只有旅行名/目的地/日期，其余折叠在 More details 与 Advanced 里。</p>
        <p>· 每个可协商字段配 Fixed / Open 开关，决定它在下游是硬约束还是参考范围。</p>
        <p>· 进入 ② Analyze 后把 Open 改 Fixed 需二次确认（相关偏好失效）。</p>
        <p>· 出口：完成页 → ① Collect，状态转「收集中」，48h 计时开始。</p>
      </LogicNote>
    </div>
  )
}
