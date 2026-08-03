import { Card, CredibilityTag, SectionStateBadge, Button } from './primitives'
import AiNote from './AiNote'
import s from './PlanSectionCard.module.css'
import { useState } from 'react'

/**
 * 计划部分卡 —— 全站核心组件。计划书 = 这些卡的纵向排列。
 * 固定结构：标题 + 可信度标签 / 内容主体 / AI 解释行 / 底部状态栏（状态徽章 + 反馈入口）
 *
 * @param section    seed.js 中的一条 PLAN_SECTIONS
 * @param version    当前查看的版本，决定 body 与 state 取哪一支
 * @param readOnly   回看历史版本时禁用反馈入口
 * @param compromise 成员端专用：显示“你妥协了什么”，组织者端不传
 */
export default function PlanSectionCard({ section, version = 'v2', readOnly = false, compromise }) {
  const [open, setOpen] = useState(false)
  const body = section.body[version] ?? section.body.v2
  const state = section.state[version] ?? section.state.v2

  return (
    <Card>
      <header className={s.head}>
        <h3 className={s.title}>{section.icon} {section.title}</h3>
        <CredibilityTag level={section.credibility} />
      </header>

      <p className={s.body}>{body}</p>

      <AiNote expandable summary={section.ai.summary}>
        {section.ai.detail}
        {compromise && <><br /><b>Your compromise:</b> {compromise}</>}
      </AiNote>

      <hr />

      <footer className={s.foot}>
        <SectionStateBadge state={state} />
        {state === 'frozen' && (
          <span className="small muted">
            AI 不得再改，除非硬约束触发且在摘要显式说明。
          </span>
        )}
        {!readOnly && state !== 'frozen' && (
          <Button onClick={() => setOpen(o => !o)}>{open ? 'Close' : 'Give feedback'}</Button>
        )}
      </footer>

      {open && !readOnly && (
        <div className={s.feedback}>
          <label className="small">
            Rating
            <select defaultValue="4"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
          </label>
          <textarea rows={2} placeholder="Your comment — conditions must be actionable to enter the engine" />
          <div className="row">
            {/* 可见性两档：小组可见 / 仅 AI */}
            <select defaultValue="group">
              <option value="group">Visible to group</option>
              <option value="ai">AI only 🔒</option>
            </select>
            <Button variant="primary" onClick={() => setOpen(false)}>Send</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
