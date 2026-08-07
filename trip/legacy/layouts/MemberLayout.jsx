import { Outlet, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { Banner, Button } from '../components/primitives'
import { useTrips } from '../context/TripContext'
import { MEMBER_STEPS } from '../data/trips'
import s from './AppLayout.module.css'

/** 成员端外壳。桌面网页布局，与组织者端同构，只是导航条目与身份区不同。 */
export default function MemberLayout() {
  const { trips, getTrip } = useTrips()
  const { tripId } = useParams()
  const open = tripId ? getTrip(tripId) : null
  const stepIndex = open ? MEMBER_STEPS.findIndex(x => x.id === open.member.current) + 1 : 0

  return (
    <>
      <Sidebar
        title="TripSync"
        subtitle="Member workspace"
        user={{ initial: 'M', label: 'Mia · guest' }}
        links={[
          { to: '/member', end: true, icon: '🧳', label: 'My Trips', count: trips.filter(t => !t.archived).length },
          { to: '/member/archived', icon: '🗄', label: 'Archived', count: trips.filter(t => t.archived).length },
          { to: '/member/invite', icon: '✉', label: 'Open an invite link' },
        ]}
        currentTrip={open && { name: open.name, hint: `open · step ${stepIndex} of 3` }}
        footer={
          <Banner tone="warn">
            <span className="small">
              You're a <b>guest</b>. Save your record so you keep your preferences and votes on another device.
            </span>
            <div style={{ marginTop: 'var(--sp-2)' }}><Button>Save to account</Button></div>
          </Banner>
        }
      />
      <main className={s.main}><Outlet /></main>
    </>
  )
}
