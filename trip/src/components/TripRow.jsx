import { useNavigate } from 'react-router-dom'
import { Badge, Button } from './primitives'
import s from './TripRow.module.css'

/**
 * 旅行列表中的一行。点击整行进入该 trip。
 * hint 由调用方按角色传入 —— 组织者看"还差谁"，成员看"要我做什么"。
 */
export default function TripRow({ trip, to, hint, action, opensAt }) {
  const navigate = useNavigate()
  return (
    <div className={s.row} onClick={() => navigate(to)}>
      <div className={s.main}>
        <div className="row">
          <b>{trip.name}</b>
          <Badge tone={trip.status.tone}>{trip.status.label}</Badge>
        </div>
        <span className="muted small">
          {trip.dates} · {trip.people} people
          {hint && <> · <b className={s.hint}>{hint}</b></>}
          {trip.deadline && <> · {trip.deadline}</>}
        </span>
      </div>
      {opensAt && <span className="small muted">Opens at {opensAt}</span>}
      {action}
      <Button>Open →</Button>
    </div>
  )
}
