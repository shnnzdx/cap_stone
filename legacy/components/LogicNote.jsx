import s from './LogicNote.module.css'

/**
 * 逻辑说明块 —— 原型专用，真实产品中不存在。
 * 每屏底部一块：入口、目标、关键分支、出口、对应的边界决策编号。
 * 作用是让组员和评委不用翻文档就能读懂这一页在整条链路里的位置。
 */
export default function LogicNote({ title, children }) {
  return (
    <details className={s.note}>
      <summary className={s.summary}>📋 {title}</summary>
      <div className={s.body}>{children}</div>
    </details>
  )
}
