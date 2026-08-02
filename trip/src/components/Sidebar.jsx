import { NavLink } from 'react-router-dom'
import { Avatar } from './primitives'
import s from './Sidebar.module.css'

/**
 * 主导航：侧边栏。两端结构一致，条目由 props 决定。
 * 全局导航（My Trips / Archived / 设置）在这里；
 * 阶段导航不进侧边栏，由 SubNav 在 trip 内承担。
 */
export default function Sidebar({ title, subtitle, links, currentTrip, footer, user }) {
  return (
    <aside className={s.sidebar}>
      <div className={s.logo}>
        {title}
        <small>{subtitle}</small>
      </div>

      <nav>
        {links.map(link => (
          <NavLink
            key={link.to} to={link.to} end={link.end}
            className={({ isActive }) => `${s.nav} ${isActive ? s.navOn : ''}`}
          >
            <span>{link.icon} {link.label}</span>
            {link.count != null && <span className={s.count}>{link.count}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={s.group}>Current trip</div>
      <div className={s.currentTrip}>
        {currentTrip ? (
          <>
            <b>{currentTrip.name}</b>
            <br />
            <span className="small muted">{currentTrip.hint}</span>
          </>
        ) : (
          <span className="small muted">No trip open. Pick one from the list.</span>
        )}
      </div>

      <div className={s.foot}>
        {footer}
        <a className={s.nav}>⚙ Account settings</a>
        <a className={s.nav}>↩ Sign out</a>
        <div className={s.user}>
          <Avatar initial={user.initial} />
          <span className="small">{user.label}</span>
        </div>
      </div>
    </aside>
  )
}
