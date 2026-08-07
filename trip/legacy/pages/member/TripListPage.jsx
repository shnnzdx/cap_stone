import { Banner } from '../../components/primitives'
import TripRow from '../../components/TripRow'
import LogicNote from '../../components/LogicNote'
import { useTrips } from '../../context/TripContext'
import { MEMBER_STEPS } from '../../data/trips'
import s from '../../layouts/AppLayout.module.css'

/**
 * 成员端旅行列表。
 * 与组织者列表同构，但摘要行说的是"要我做什么"，而不是"还差谁"。
 */
export default function MemberTripListPage({ archived = false }) {
  const { trips } = useTrips()
  const rows = trips.filter(t => t.archived === archived)

  const stepLabel = id => MEMBER_STEPS.find(x => x.id === id)?.label ?? id
  const stepIndex = id => MEMBER_STEPS.findIndex(x => x.id === id) + 1

  return (
    <>
      <header className={s.listHead}>
        <span className={s.listTitle}>{archived ? 'Archived' : 'My trips'}</span>
      </header>

      <div className={s.wrap}>
        <p className="muted small">
          Sorted by what needs you. You never see other members' individual scores or the organizer's internal tools.
        </p>

        {rows.length === 0 ? (
          <Banner tone="neutral">Nothing here yet. Open an invite link to join a trip.</Banner>
        ) : (
          rows.map(trip => (
            <TripRow
              key={trip.id}
              trip={trip}
              to={`/member/trip/${trip.id}`}
              hint={trip.listHint.member}
              opensAt={`${stepLabel(trip.member.current)} (step ${stepIndex(trip.member.current)} of 3)`}
            />
          ))
        )}

        <LogicNote title="成员端列表逻辑">
          <p>· 成员看到的是「我在这个 trip 的三步进度」，不是组织者的五阶段。</p>
          <p>· 覆盖关系：① Share preferences = Collect + Analyze；② Review the plan = Plan + Review；③ Confirm = Lock。</p>
          <p>· 点进 trip → 二级栏出现三步；已完成步可点回看，但只回看本人参与过的内容。</p>
          <p>· 成员看不到冲突全貌、修改预案、他人满意度明细；但必须看到自己的进度与等待原因。</p>
        </LogicNote>
      </div>
    </>
  )
}
