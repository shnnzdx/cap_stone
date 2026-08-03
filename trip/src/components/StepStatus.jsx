import s from './StepStatus.module.css'

/**
 * 成员端三行文案：当前步骤 / 我的状态 / 在等什么。
 * 这是成员端的核心信息设计 —— 成员看不到全局，必须靠这三行知道
 * "我在哪一步、我做完没有、卡在谁身上"。
 */
export default function StepStatus({ lines }) {
  const [step, mine, waiting] = lines
  return (
    <div className={s.box}>
      <b>{step}</b>
      <div>{mine}</div>
      <div className="muted small">{waiting}</div>
    </div>
  )
}
