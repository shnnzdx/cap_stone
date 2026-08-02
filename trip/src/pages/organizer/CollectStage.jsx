import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, Badge, Button, Avatar, MemberRow } from '../../components/primitives'
import AiNote from '../../components/AiNote'
import DemoSwitch from '../../components/DemoSwitch'
import LogicNote from '../../components/LogicNote'
import { useTrips } from '../../context/TripContext'
import s from '../../layouts/AppLayout.module.css'

/**
 * A3 · 需求收集（组织者视角）
 * 目标：看清还差谁，推动收齐。
 * 关键：组织者完全等同成员 —— 也要提交偏好、接受也算一票（决策1）。
 */
export default function CollectStage() {
  const { trip } = useOutletContext()
  const { advance } = useTrips()
  const navigate = useNavigate()
  const [demo, setDemo] = useState('waiting')

  const roster = [
    { initial: 'E', name: 'Emma', note: '(you — organizer counts as a normal member)', tone: 'ok', label: 'Submitted ✓' },
    { initial: 'N', name: 'Noah', tone: 'ok', label: 'Submitted ✓' },
    { initial: 'M', name: 'Mia', tone: 'warn', label: 'Draft in progress', remind: true },
    { initial: 'L', name: 'Liam', tone: 'neutral', label: 'Not started', remind: true },
  ]

  const goAnalyze = () => {
    advance(trip.id, 'organizer', 'analyze')
    navigate(`/organizer/trip/${trip.id}/analyze`)
  }

  return (
    <>
      <DemoSwitch
        value={demo} onChange={setDemo}
        options={[{ value: 'waiting', label: '未收齐' }, { value: 'ready', label: '收齐/截止' }]}
      />

      <div className={s.grid}>
        <div>
          <Card>
            <h3>Member progress · 2 of {trip.people} submitted</h3>
            {roster.map(m => (
              <MemberRow key={m.name}>
                <Avatar initial={m.initial} />
                <b>{m.name}</b>
                {m.note && <span className="muted small">{m.note}</span>}
                <span className="spacer" />
                <Badge tone={m.tone}>{m.label}</Badge>
                {m.remind && <Button>Remind</Button>}
              </MemberRow>
            ))}
            <hr />
            <a className="small">✎ Edit my own preferences</a>
          </Card>

          <Card>
            <h3>Join request</h3>
            <div className="row">
              <Avatar initial="S" />
              <b>Sofia</b>
              <span className="muted small">opened the invite link after collection started</span>
              <span className="spacer" />
              <Button variant="primary">Approve</Button>
              <Button>Decline</Button>
            </div>
            <p className="small muted">新成员的约束进下一轮，不推翻当前版本（决策2）。</p>
          </Card>

          <Card>
            {demo === 'waiting' ? (
              <>
                <Button variant="primary" disabled>Start analysis</Button>
                <span className="muted small"> Enabled when everyone submits or the deadline passes.</span>
                <p className="small">
                  <a onClick={goAnalyze}>Advance now with current responses →</a>{' '}
                  <span className="muted">（晚到反馈归入下一轮）</span>
                </p>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={goAnalyze}>Start analysis → ② Analyze</Button>
                <p className="small muted">
                  未提交者代入默认偏好或标记不参与本轮；弃权不阻塞，其硬约束仍有效。
                </p>
              </>
            )}
          </Card>
        </div>

        <div>
          <AiNote>
            <b>Live preview</b><br />
            Received 2 of {trip.people}. Both prefer museums; budget answers range widely — a divergence is likely.
            I'll structure it in ② Analyze.
          </AiNote>
          <Card>
            <b className="small">Invite link</b>
            <p className="small">tripsync.app/j/CHI-4F2K <Button>Copy</Button></p>
            <p className="small">Status: <Badge tone="ok">Active</Badge> · <a>Revoke</a></p>
          </Card>
          <Card>
            <b className="small">Deadline</b>
            <p className="small">⏱ {trip.deadline} · <a>Extend</a></p>
          </Card>
        </div>
      </div>

      <LogicNote title="① Collect 逻辑">
        <p>· 入口：创建完成 / 列表路由 / 收齐通知。目标：看清还差谁，推动收齐。</p>
        <p>· 组织者完全等同成员：提交偏好、表态、接受算一票（决策1）。</p>
        <p>· 截止后未提交者代入默认偏好或标记不参与；有人退出 → 约束即刻移除，AI 提示影响（决策3）。</p>
        <p>· 出口：收齐或截止 →「Start analysis」→ ② Analyze。</p>
      </LogicNote>
    </>
  )
}
