import { Outlet, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useTrips } from '../context/TripContext'
import s from './AppLayout.module.css'

/** 组织者端外壳：侧边栏（全局导航）+ 内容区。阶段导航不在这里，由 SubNav 承担。 */
export default function OrganizerLayout() {
  const { trips, getTrip } = useTrips()
  const { tripId } = useParams()
  const open = tripId ? getTrip(tripId) : null

  return (
    <>
      <Sidebar
        title="TripSync"
        subtitle="Organizer workspace"
        user={{ initial: 'E', label: 'Emma · organizer' }}
        links={[
          { to: '/organizer', end: true, icon: '🧳', label: 'My Trips', count: trips.filter(t => !t.archived).length },
          { to: '/organizer/archived', icon: '🗄', label: 'Archived', count: trips.filter(t => t.archived).length },
        ]}
        currentTrip={open && { name: open.name, hint: `open · ${open.organizer.current}` }}
      />
      <main className={s.main}><Outlet /></main>
    </>
  )
}
