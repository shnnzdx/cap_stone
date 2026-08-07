import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button } from '../../components/primitives'
import DemoSwitch from '../../components/DemoSwitch'
import LogicNote from '../../components/LogicNote'
import s from '../../layouts/AppLayout.module.css'

/**
 * B1 · 邀请落地
 * 目标：3 秒建立信任 —— 谁邀请你、什么行程、要花多久、不用注册。
 * 链接五态各有明确文案与出口，不出现空白页。
 */
export default function InvitePage() {
  const navigate = useNavigate()
  const [demo, setDemo] = useState('valid')

  return (
    <>
      <header className={s.listHead}>
        <span className={s.listTitle}>Invite link</span>
      </header>

      <div className={`${s.wrap} ${s.wrapNarrow}`}>
        <DemoSwitch
          label="链接状态" value={demo} onChange={setDemo}
          options={[
            { value: 'valid', label: '有效' },
            { value: 'closed', label: '收集已截止' },
            { value: 'revoked', label: '已撤销' },
            { value: 'ended', label: '旅行已结束' },
          ]}
        />

        {demo === 'valid' && (
          <>
            <Card>
              <div style={{ textAlign: 'center', padding: 'var(--sp-6)' }}>
                <div style={{ fontSize: 44 }}>🏙</div>
                <h2>Emma invited you to <b>Chicago Trip</b></h2>
                <p className="muted">
                  Oct 10–12 · 4 people · lock rule: unanimous · fixed: destination 🔒, dates 🔒
                </p>
                <Button variant="primary" onClick={() => navigate('/member/trip/denver/preferences')}>
                  Start · about 3 min
                </Button>
                <p className="small muted">
                  No account needed — just a nickname. Add an email if you want to recover your record on another device.
                </p>
              </div>
            </Card>
            <Card>
              <p className="small muted">
                加入即创建 Guest：sessionToken（浏览器持续访问）+ claimCode（一次性认领码，不入 URL）。
                两个 token 分离 —— 前者泄露只影响浏览，后者才是身份凭证。
              </p>
            </Card>
          </>
        )}

        {demo === 'closed' && (
          <Card>
            <h3>Preference collection has closed</h3>
            <p className="small">
              You can still ask to join — the organizer approves and your input goes into the next round.
            </p>
            <Button variant="primary">Request late entry</Button>
          </Card>
        )}

        {demo === 'revoked' && (
          <Card>
            <h3>This invite link was revoked</h3>
            <p className="small muted">The organizer disabled this link. Ask them for a new one.</p>
          </Card>
        )}

        {demo === 'ended' && (
          <Card>
            <h3>This trip has ended</h3>
            <p className="small">You can join read-only to see the final plan.</p>
            <Button>View read-only</Button>
          </Card>
        )}

        <LogicNote title="B1 · 邀请落地逻辑 + 身份机制">
          <p>· 3 秒建立信任：谁邀请你、什么行程、要花多久、不用注册。</p>
          <p>· 链接五态：有效 / 已撤销 / 已过期 / 只读（已锁定）/ 已失效（已结束）。</p>
          <p>· 认领三原则：访问与认领用两个不同 token；认领必须用户主动确认，不静默完成；认领后 Guest 与账号合并而非新建。</p>
          <p>· 边界：同链接多人打开 → 各建独立 Guest；同浏览器重复打开 → 复用 token；换设备 → 邮箱恢复或旅行编码 + 组织者审批。</p>
        </LogicNote>
      </div>
    </>
  )
}
