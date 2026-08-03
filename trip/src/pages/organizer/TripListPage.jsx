import { useNavigate } from 'react-router-dom'
import { Banner, Button } from '../../components/primitives'
import TripRow from '../../components/TripRow'
import LogicNote from '../../components/LogicNote'
import { useTrips } from '../../context/TripContext'
import { ORGANIZER_STAGES } from '../../data/trips'
import s from '../../layouts/AppLayout.module.css'

/**
 * A1 · 旅行列表（登录首屏）
 * 目标：5 秒把人送回该做事的旅行。
 * 排序：待我行动 > 等待他人 > 已锁定沉底。不设 Completed 分区（决策16）。
 */
export default function TripListPage({ archived = false }) {
  const { trips, toggleArchive } = useTrips()
  const navigate = useNavigate()
  const rows = trips.filter(t => t.archived === archived)

  const stageLabel = id => ORGANIZER_STAGES.find(x => x.id === id)?.label ?? id

  return (
    <>
      <header className={s.listHead}>
        <span className={s.listTitle}>{archived ? 'Archived' : 'My trips'}</span>
        <span className="spacer" />
        {!archived && (
          <Button variant="primary" onClick={() => navigate('/organizer/create')}>+ Create trip</Button>
        )}
      </header>

      <div className={s.wrap}>
        {!archived && (
          <Banner tone="info">
            We found a guest record “<b>Mia</b>” in <b>Chicago Trip</b> made on this browser.{' '}
            <Button>Confirm &amp; link to my account</Button> <a className="small">Ignore</a>
            <div className="small muted">
              Linking merges past preferences and votes — it never happens silently.
            </div>
          </Banner>
        )}

        <p className="muted small">
          {archived
            ? 'Archived trips stay fully readable. Unarchiving moves them back to My Trips.'
            : 'Sorted by what needs you: action needed → waiting on others → locked.'}
        </p>

        {rows.length === 0 ? (
          <Banner tone="neutral">
            Nothing here yet. {archived
              ? 'Archive a trip from its Lock stage to file it away.'
              : 'Create a trip, or open the invite link a friend sent you.'}
          </Banner>
        ) : (
          rows.map(trip => (
            <TripRow
              key={trip.id}
              trip={trip}
              to={`/organizer/trip/${trip.id}`}
              hint={trip.listHint.organizer}
              opensAt={stageLabel(trip.organizer.current)}
              action={
                <Button onClick={e => { e.stopPropagation(); toggleArchive(trip.id) }}>
                  {trip.archived ? 'Unarchive' : 'Archive'}
                </Button>
              }
            />
          ))
        )}

        <hr />
        <p className="muted small">
          Invited by a friend? Just open the link they sent you — no need to do anything here.<br />
          Lost the link? Enter the trip code and the organizer will confirm you:
        </p>
        <div className="row" style={{ maxWidth: 420 }}>
          <input type="text" placeholder="Trip code, e.g. CHI-4F2K" />
          <Button>Request to claim</Button>
        </div>

        <LogicNote title="A1 · 旅行列表逻辑">
          <p>· 登录首屏。排序：待我行动 &gt; 等待他人 &gt; 已锁定沉底。</p>
          <p>· <b>不设 Completed 分区</b>（决策16）：锁定是流程状态，用卡片徽章表达；归档是列表可见性，用户可逆操作。</p>
          <p>· 待认领 Guest 记录 → 顶部提示条，必须<b>主动确认</b>绑定；认领后合并而非新建。</p>
          <p>· 无「加入」模块；旅行编码 + 组织者审批仅作认领兜底。</p>
          <p>· 出口：点任意行 → 该 trip 工作区，落点按「计划状态 × 我的动作状态」自动选中当前阶段。</p>
        </LogicNote>
      </div>
    </>
  )
}
