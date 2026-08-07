import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import SubNav from '../components/SubNav'
import { Banner, Button } from '../components/primitives'
import { useTrips } from '../context/TripContext'
import { ORGANIZER_STAGES, MEMBER_STEPS, stageState } from '../data/trips'
import s from './AppLayout.module.css'

/**
 * 单个 trip 的工作区外壳：二级栏 + 阶段内容。
 *
 * 路由规则「深链表达意图，不表达位置」在这里落地：
 *  · trip 不存在        → 404 兜底，不出现空白页
 *  · 未指定阶段         → 重定向到"我的下一步动作"所在阶段
 *  · 深链指向未到的阶段 → 降级重定向到当前阶段（越权不报错，只是看不到）
 *  · 深链指向已完成阶段 → 放行，但显示只读横幅 + 返回当前阶段
 */
export default function TripWorkspace({ side }) {
  const { tripId } = useParams()
  const { pathname } = useLocation()
  const { getTrip } = useTrips()
  const trip = getTrip(tripId)

  if (!trip) {
    return (
      <div className={s.wrap}>
        <Banner tone="danger">
          <b>Trip not found.</b> It may have been deleted, or the link is wrong.
        </Banner>
        <Button onClick={() => window.history.back()}>← Go back</Button>
      </div>
    )
  }

  const progress = trip[side]
  const stages = side === 'organizer' ? ORGANIZER_STAGES : MEMBER_STEPS
  const basePath = `/${side}/trip/${tripId}`

  // 阶段取自 URL 末段。未指定 / 不存在 / 未到 → 一律降级到"我的下一步动作"所在阶段。
  const segment = pathname.split('/').filter(Boolean).pop()
  const stage = stages.some(x => x.id === segment) ? segment : null
  if (!stage || stageState(progress, stage) === 'locked') {
    return <Navigate to={`${basePath}/${progress.current}`} replace />
  }

  const isPast = stageState(progress, stage) === 'done'

  return (
    <>
      <SubNav
        trip={trip}
        progress={progress}
        stages={stages}
        basePath={basePath}
        meta={`${trip.dates} · ${trip.people} people · ⏱ ${trip.deadline}`}
      />
      <div className={s.wrap}>
        {isPast && (
          <Banner tone="warn">
            You're looking at a completed stage — read-only.{' '}
            <a href={`${basePath}/${progress.current}`}>Back to the current stage →</a>
          </Banner>
        )}
        {/* 阶段页通过 context 拿到 trip 与只读标记，不必各自重复取数 */}
        <Outlet context={{ trip, progress, isPast, side }} />
      </div>
    </>
  )
}
