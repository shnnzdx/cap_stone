import { Link } from 'react-router-dom'
import { Card } from '../components/primitives'
import s from './HomePage.module.css'

/** 原型入口页：选择进入哪一端。真实产品里由登录态决定，不存在这一页。 */
export default function HomePage() {
  return (
    <div className={s.page}>
      <h1>TripSync</h1>
      <p className="muted">AI-mediated group trip planning · front-end logic prototype (v4)</p>
      <p className="small">
        Wireframe fidelity on purpose: the goal is a clear logic chain and clear sections, not visual polish.
        Colors live in <code>src/styles/tokens.css</code> — swap that one file when the Design System lands.
      </p>

      <div className={s.pick}>
        <Link to="/organizer" className={s.card}>
          <b>Organizer →</b>
          <span className="small">
            Sidebar: My Trips / Archived. Open a trip → stage tabs
            ① Collect ② Analyze ③ Plan ④ Review ⑤ Lock.
          </span>
        </Link>
        <Link to="/member" className={s.card}>
          <b>Member →</b>
          <span className="small">
            Sidebar: My Trips / Archived / invite link. Open a trip → step tabs
            ① Share preferences ② Review the plan ③ Confirm the trip.
          </span>
        </Link>
      </div>

      <Card>
        <b>How to read this prototype</b>
        <ul className="small">
          <li>Every screen has a blue <b>演示状态</b> switcher for its branches (v1 / v2 / generation failed, pre-lock / execution / ended, link revoked …).</li>
          <li>Every screen ends with a yellow <b>📋 逻辑说明</b> block: entry, goal, branches, exit, decision number.</li>
          <li>Seed data is the Chicago four (Emma / Noah / Mia / Liam) throughout.</li>
          <li>Both switchers are prototype scaffolding — search <code>DemoSwitch</code> and <code>LogicNote</code> to strip them before shipping.</li>
        </ul>
      </Card>
    </div>
  )
}
