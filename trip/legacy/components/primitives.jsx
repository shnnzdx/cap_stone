import s from './primitives.module.css'

/* 展示型原子组件。业务页面只组合它们，不重复写样式。 */

const TONE = {
  ok: s.toneOk, warn: s.toneWarn, danger: s.toneDanger,
  info: s.toneInfo, frozen: s.toneFrozen, neutral: s.toneNeutral,
}

export function Card({ variant, children, ...rest }) {
  const cls = [s.card, variant === 'emphasis' && s.cardEmphasis, variant === 'dashed' && s.cardDashed]
    .filter(Boolean).join(' ')
  return <div className={cls} {...rest}>{children}</div>
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`${s.badge} ${TONE[tone]}`}>{children}</span>
}

/** 部分状态徽章：五种必须可区分。硬约束违反永远配锁图标。 */
const SECTION_STATE = {
  accepted:  { tone: 'ok',      label: 'Accepted' },
  pending:   { tone: 'warn',    label: 'Pending feedback' },
  modified:  { tone: 'info',    label: 'Modified in this version' },
  violation: { tone: 'danger',  label: '🔒 Violates a hard constraint — locking blocked' },
  frozen:    { tone: 'frozen',  label: 'Frozen ❄ (accepted 2 rounds)' },
}
export function SectionStateBadge({ state }) {
  const cfg = SECTION_STATE[state] ?? SECTION_STATE.pending
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

/** 可信度标签：四种必须可区分 */
const CRED = {
  mock:       { cls: s.credMock,       label: 'Mock data' },
  estimate:   { cls: s.credEstimate,   label: 'AI estimate' },
  verified:   { cls: s.credVerified,   label: 'Verified' },
  unverified: { cls: s.credUnverified, label: 'Unverified' },
}
export function CredibilityTag({ level }) {
  const cfg = CRED[level] ?? CRED.mock
  return <span className={`${s.cred} ${cfg.cls}`}>{cfg.label}</span>
}

export function Chip({ locked, children }) {
  return <span className={`${s.chip} ${locked ? s.chipLocked : ''}`}>{locked ? '🔒 ' : ''}{children}</span>
}

export function Banner({ tone = 'info', children }) {
  return <div className={`${s.banner} ${TONE[tone]}`}>{children}</div>
}

export function Button({ variant, children, ...rest }) {
  const cls = [s.btn, variant === 'primary' && s.btnPrimary, variant === 'danger' && s.btnDanger]
    .filter(Boolean).join(' ')
  return <button type="button" className={cls} {...rest}>{children}</button>
}

export function Avatar({ initial }) {
  return <span className={s.avatar}>{initial}</span>
}

export function MemberRow({ children }) {
  return <div className={s.memberRow}>{children}</div>
}
