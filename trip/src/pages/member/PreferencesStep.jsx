import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Card, Badge, Button, MemberRow } from '../../components/primitives'
import AiNote from '../../components/AiNote'
import StepStatus from '../../components/StepStatus'
import DemoSwitch from '../../components/DemoSwitch'
import LogicNote from '../../components/LogicNote'
import { useTrips } from '../../context/TripContext'
import s from '../../layouts/AppLayout.module.css'
import c from './Chat.module.css'

/**
 * B2 · 需求提交（成员核心页）
 * 目标：3 分钟完成。对话式输入 → AI 追问澄清 → 结构化确认卡 → 提交。
 * 全程草稿云端自动保存；低置信度字段高亮强制过目。
 */
export default function PreferencesStep() {
  const { trip } = useOutletContext()
  const { advance } = useTrips()
  const navigate = useNavigate()
  const [phase, setPhase] = useState('chat')  // chat | confirm | done

  const submit = () => {
    setPhase('done')
    advance(trip.id, 'member', 'review')
  }

  return (
    <>
      <StepStatus lines={trip.member.lines} />
      <DemoSwitch
        value={phase} onChange={setPhase}
        options={[
          { value: 'chat', label: '① 对话输入' },
          { value: 'confirm', label: '② 结构化确认' },
          { value: 'done', label: '③ 已提交' },
        ]}
      />

      <div className={s.grid}>
        <div>
          {phase === 'chat' && (
            <Card>
              <h3>Tell me about your ideal trip</h3>
              <div className={`${c.bubble} ${c.ai}`}>
                ✨ Hi Mia! Budget, food, pace, must-sees — plain language is fine.
              </div>
              <div className={`${c.bubble} ${c.me}`}>
                I love museums and local culture. Budget around $1,200. I'd rather not spend the whole day walking.
              </div>
              <div className={`${c.bubble} ${c.ai}`}>
                ✨ Two quick follow-ups:<br />
                1. If the plan runs <b>$50 over</b> your budget, is that acceptable?<br />
                2. “Not the whole day walking” — is ~2 km/day a comfortable cap?
              </div>
              <textarea rows={3} placeholder="Type your answer…" />
              <div className="row">
                <span className="small muted">☁ Draft saved · just now（云端，换设备自动恢复）</span>
                <span className="spacer" />
                <Button variant="primary" onClick={() => setPhase('confirm')}>Continue →</Button>
              </div>
            </Card>
          )}

          {phase === 'confirm' && (
            <Card>
              <h3>Confirm what I understood</h3>
              <p className="small muted">Edit anything. Choose who can see each item.</p>

              <MemberRow>
                <span className="small">💰 Budget: <b>$1,200</b> (+$50 flex OK)</span>
                <span className="spacer" />
                <select defaultValue="ai" style={{ width: 'auto' }}>
                  <option value="ai">AI only 🔒</option>
                  <option value="group">Visible to group</option>
                </select>
                <a className="small">edit</a>
              </MemberRow>

              <MemberRow>
                <span className="small">🏛 Museums &amp; local culture — high priority</span>
                <span className="spacer" />
                <select defaultValue="group" style={{ width: 'auto' }}>
                  <option value="group">Visible to group</option>
                  <option value="ai">AI only 🔒</option>
                </select>
                <a className="small">edit</a>
              </MemberRow>

              {/* 低置信度字段：高亮并强制过目 */}
              <MemberRow>
                <span className="small">
                  🚶 <b>Walking cap ~2 km/day</b> <Badge tone="warn">low confidence — please confirm</Badge>
                </span>
                <span className="spacer" />
                <select defaultValue="ai" style={{ width: 'auto' }}>
                  <option value="ai">AI only 🔒</option>
                  <option value="group">Visible to group</option>
                </select>
                <a className="small">edit</a>
              </MemberRow>

              <div className="row" style={{ marginTop: 'var(--sp-3)' }}>
                <span className="small muted">☁ Draft saved</span>
                <span className="spacer" />
                <Button variant="primary" onClick={submit}>Submit preferences</Button>
              </div>
            </Card>
          )}

          {phase === 'done' && (
            <Card>
              <h3>Submitted ✓</h3>
              <p className="small">
                Your preferences are in. You can still edit them — changes count as input for the <b>next</b> round
                and don't invalidate the current version（决策9）。
              </p>
              <div className="row">
                <Button>✎ Edit my preferences</Button>
                <Button variant="primary" onClick={() => navigate(`/member/trip/${trip.id}/review`)}>
                  Go to ② Review the plan →
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <h3>What happens next</h3>
            <p className="small">
              The organizer runs a conflict analysis, then the AI drafts a plan.
              You'll be notified when it's ready to review.
            </p>
            <p className="small muted">
              你看不到冲突全貌与他人偏好明细 —— 只会看到与你本人已确认条件相关的冲突。
            </p>
          </Card>
          <Card>
            <h3>Privacy</h3>
            <p className="small">
              🔒 “AI only” items are never shown to the group, and hard constraints are never attributed to a person.
            </p>
          </Card>
          <AiNote>
            私密约束死局时，同一对话组件会被复用：AI 私下联系你，给出三选一
            （调约束 / 提方案 / 退出），全组只见匿名结论（决策8）。
          </AiNote>
        </div>
      </div>

      <LogicNote title="① Share preferences 逻辑">
        <p>· 目标 3 分钟完成：对话式自然语言输入 → AI 追问澄清（含条件前置问题“如果超预算 $50 能接受吗”）→ 结构化确认卡。</p>
        <p>· 低置信度字段高亮<b>强制过目</b>；每条可选可见性两档（小组可见 / 仅 AI 🔒）。</p>
        <p>· 全程草稿云端自动保存（draft_content + updated_at），提交确认后删除。</p>
        <p>· 审核期改偏好 → 作为下一轮输入，不立即触发版本失效（决策9）。</p>
      </LogicNote>
    </>
  )
}
