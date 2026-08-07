import s from './AiNote.module.css'

/**
 * AI 发言的统一可识别样式（语义原则二）。
 * 全站所有 AI 输出都必须走这个组件，不允许各页自己画。
 * expandable=true 时渲染为可展开的解释行（计划部分卡每卡必有）。
 */
export default function AiNote({ summary, children, expandable = false }) {
  if (!expandable) {
    return <div className={s.note}>✨ {children}</div>
  }
  return (
    <details className={s.note}>
      <summary className={s.summary}>✨ {summary}</summary>
      <div className={s.detail}>{children}</div>
    </details>
  )
}
