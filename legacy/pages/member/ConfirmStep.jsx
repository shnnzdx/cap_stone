import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Card, Badge, Button, Banner } from '../../components/primitives'
import StepStatus from '../../components/StepStatus'
import DemoSwitch from '../../components/DemoSwitch'
import LogicNote from '../../components/LogicNote'
import s from '../../layouts/AppLayout.module.css'

/**
 * B4 后续 · 确认与执行期（成员视角）
 * 锁定 = 全组正式拍板。成员在执行期只被通知①档变更；
 * ③档结构性变更会强制重开协商，接受状态失效并回到 ② Review。
 */
export default function ConfirmStep() {
  const { trip } = useOutletContext()
  const [demo, setDemo] = useState(trip.id === 'nyc' || trip.id === 'boston' ? 'locked' : 'waiting')

  return (
    <>
      <StepStatus lines={trip.member.lines} />
      <DemoSwitch
        value={demo} onChange={setDemo}
        options={[
          { value: 'waiting', label: '已表态，等全组' },
          { value: 'locked', label: '已锁定 · 执行期' },
          { value: 'ended', label: '已结束' },
        ]}
      />

      {demo === 'waiting' && (
        <Card>
          <h3>Your review is in ✓</h3>
          <p className="small">
            Waiting for 2 more members. The trip locks when the lock rule (<b>unanimous</b>) is met —
            you'll be notified.
          </p>
          <p className="small muted">
            若组织者发起「终局投票」，你会收到一次逐部分的最后表态请求。
          </p>
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
                <h3>Final plan (read-only)</h3>
                <p className="small">
                  🗺 Chicago Oct 10–12 · 4 people<br />
                  🏨 Hampton Inn River North · $172/night<br />
                  📅 Day 1 The Loop · Day 2 Museums + food (v2.1: dinner swapped to Giordano's) · Day 3 Wicker Park<br />
                  💰 $1,420 / person
                </p>
                <Button>Export / add to calendar</Button>
              </Card>
              <Card>
                <h3>🔔 Execution updates</h3>
                <p className="small">
                  v2.1 — dinner venue swapped to Giordano's, same price.{' '}
                  <Badge tone="neutral">No response needed</Badge>
                </p>
                <p className="small muted">
                  ①档变更只通知不表态；若组织者改日期 / 目的地 / 成员构成 / 硬约束（③档），
                  会强制重开协商，你的接受状态失效并回到 ② Review。
                </p>
              </Card>
            </div>
            <div>
              <Card>
                <h3>📜 What happened</h3>
                <ul className="small">
                  <li>Your condition “≤$180/night” — satisfied ✓</li>
                  <li>Your condition “hotel pool” — skipped, reason given</li>
                  <li>You compromised: smaller rooms; crawl shortened</li>
                  <li>Lock: unanimous, Oct 1</li>
                </ul>
                <hr />
                <a className="small">🚪 Leave this trip</a>
                <span className="small muted">（拍板败者出口 · 决策7）</span>
              </Card>
            </div>
          </div>
        </>
      )}

      {demo === 'ended' && (
        <>
          <Banner tone="info">
            <b>Trip ended</b> · fully read-only. Thanks for travelling with the group.
          </Banner>
          <Card>
            <p className="small muted">最终计划 + 你的参与记录永久保存；可归档。</p>
          </Card>
        </>
      )}

      <LogicNote title="③ Confirm the trip 逻辑">
        <p>· 锁定 = 全组正式拍板，决策期结束、执行期开始 —— 不是 AI 定的。</p>
        <p>· 执行期你只被通知①档变更；③档强制重开 → 接受状态失效 → 回到 ② Review 重新表态。</p>
        <p>· 未满足的条件与你的妥协记录写入 Decision Log，附退出入口（决策7）。</p>
        <p>· 过旅行结束日期 → 自动转「已结束」，真正只读。</p>
      </LogicNote>
    </>
  )
}
