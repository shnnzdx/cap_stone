import { NavLink, useNavigate } from 'react-router-dom'
import { Badge } from './primitives'
import { stageState } from '../data/trips'
import s from './SubNav.module.css'

/**
 * 二级栏：进入某个 trip 后出现，承载该 trip 的阶段导航。
 * 阶段三态：
 *   done     已完成 —— 可点回看（页面会显示只读横幅 + 返回当前阶段）
 *   current  当前   —— 高亮
 *   locked   未到   —— 不可点（阶段导航同时是权限闸门）
 */
export default function SubNav({ trip, progress, stages, basePath, meta }) {
  const navigate = useNavigate()

  return (
    <div className={s.subnav}>
      <div className={s.top}>
        <button type="button" className={s.back} onClick={() => navigate('..')}>← My Trips</button>
        <span className={s.name}>{trip.name}</span>
        <Badge tone={trip.status.tone}>{trip.status.label}</Badge>
        <span className="spacer" />
        <span className="small muted">{meta}</span>
      </div>

      <nav className={s.tabs}>
        {stages.map(stage => {
          const state = stageState(progress, stage.id)
          if (state === 'locked') {
            return (
              <span key={stage.id} className={`${s.tab} ${s.tabLocked}`} title="Not yet — finish the earlier stages first">
                {stage.label} 🔒
              </span>
            )
          }
          return (
            <NavLink
              key={stage.id}
              to={`${basePath}/${stage.id}`}
              className={({ isActive }) =>
                [s.tab, state === 'done' && s.tabDone, isActive && s.tabCurrent].filter(Boolean).join(' ')
              }
            >
              {stage.label}{state === 'done' ? ' ✓' : ''}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
