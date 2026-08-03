import { useState } from 'react'
import { Button, Chip } from './primitives'
import s from './ReviewPanel.module.css'

/**
 * 满意度与接受分离控件（不可砍项）。底部粘性面板，左右分区：
 *  左 · 满意度：滑块，随时可改 → 喂「最低满意度优先」排序引擎，默认匿名
 *  右 · 接受状态：Accept / Accept with conditions（条件必填）/ Reject（须指认部分）→ 用于锁定判断
 *
 * 两者分离的意义：一个人可以"不满意但接受"，也可以"满意但有条件"。
 * 合成一个控件就会丢掉这个信息，排序引擎和锁定判断都会失真。
 */
export default function ReviewPanel({ version, sections, onSubmit }) {
  const [satisfaction, setSatisfaction] = useState(7)
  const [shareScore, setShareScore] = useState(false)
  const [choice, setChoice] = useState(null)
  const [condition, setCondition] = useState('')
  const [rejected, setRejected] = useState([])

  // 提交闸门：条件必填、Reject 必须指认至少一个部分
  const blocked =
    !choice ||
    (choice === 'conditions' && condition.trim() === '') ||
    (choice === 'reject' && rejected.length === 0)

  const toggleSection = id =>
    setRejected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  return (
    <section className={s.panel}>
      <b>My review · {version}</b>

      <div className={s.split}>
        {/* ── 左：满意度 ── */}
        <div className={s.col}>
          <span className="small">
            <b>Satisfaction</b> — anonymous by default; drives who gets prioritised next round
          </span>
          <input
            type="range" min={0} max={10} value={satisfaction}
            onChange={e => setSatisfaction(Number(e.target.value))}
          />
          <span className="small muted">
            0 ── <b>{satisfaction}</b> ── 10 ·{' '}
            <label>
              <input type="checkbox" checked={shareScore} onChange={e => setShareScore(e.target.checked)} />
              {' '}share my score with the group
            </label>
          </span>
        </div>

        {/* ── 右：接受状态 ── */}
        <div className={s.colWide}>
          <span className="small"><b>Acceptance</b> — used for the lock decision</span>

          <div className="row">
            {[
              ['accept', 'Accept'],
              ['conditions', 'Accept with conditions'],
              ['reject', 'Reject'],
            ].map(([id, label]) => (
              <button
                key={id} type="button"
                className={`${s.choice} ${choice === id ? s.choiceOn : ''}`}
                onClick={() => setChoice(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {choice === 'conditions' && (
            <div className={s.extra}>
              <textarea
                rows={2} value={condition} onChange={e => setCondition(e.target.value)}
                placeholder="Condition required — must be actionable, e.g. 'only if the hotel has free breakfast'"
              />
              {condition.trim() && (
                <div className="small muted">
                  ✨ AI 抽取为结构化 chip 供你确认：<Chip>{condition.trim().slice(0, 40)}</Chip>
                </div>
              )}
            </div>
          )}

          {choice === 'reject' && (
            <div className={s.extra}>
              <span className="small">You must point to at least one section:</span>
              <div className="row">
                {sections.map(sec => (
                  <label key={sec.id} className="small">
                    <input
                      type="checkbox" checked={rejected.includes(sec.id)}
                      onChange={() => toggleSection(sec.id)}
                    />{' '}
                    {sec.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button variant="primary" disabled={blocked} onClick={onSubmit}>
            Submit review
          </Button>
          {blocked && choice && (
            <span className="small muted">
              {choice === 'conditions' ? '条件必填' : '须指认至少一个部分'}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
