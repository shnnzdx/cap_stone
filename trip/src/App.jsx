import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TripProvider } from './context/TripContext'

import HomePage from './pages/HomePage'
import OrganizerLayout from './layouts/OrganizerLayout'
import MemberLayout from './layouts/MemberLayout'
import TripWorkspace from './layouts/TripWorkspace'

import OrganizerTripList from './pages/organizer/TripListPage'
import CreateTripPage from './pages/organizer/CreateTripPage'
import CollectStage from './pages/organizer/CollectStage'
import AnalyzeStage from './pages/organizer/AnalyzeStage'
import PlanStage from './pages/organizer/PlanStage'
import OrganizerReviewStage from './pages/organizer/ReviewStage'
import LockStage from './pages/organizer/LockStage'

import MemberTripList from './pages/member/TripListPage'
import InvitePage from './pages/member/InvitePage'
import PreferencesStep from './pages/member/PreferencesStep'
import MemberReviewStep from './pages/member/ReviewStep'
import ConfirmStep from './pages/member/ConfirmStep'

/**
 * 路由表 = 信息架构。
 * 组织者：/organizer/trip/:tripId/:stage    stage ∈ collect|analyze|plan|review|lock
 * 成员：  /member/trip/:tripId/:stage       stage ∈ preferences|review|confirm
 *
 * 「深链表达意图不表达位置」的落地在 TripWorkspace：
 * 未指定阶段 → 落到当前阶段；指向未到的阶段 → 降级重定向；指向已完成阶段 → 只读放行。
 */
export default function App() {
  return (
    <TripProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* ── 组织者端 ── */}
          <Route path="/organizer" element={<OrganizerLayout />}>
            <Route index element={<OrganizerTripList />} />
            <Route path="archived" element={<OrganizerTripList archived />} />
            <Route path="create" element={<CreateTripPage />} />
            <Route path="trip/:tripId" element={<TripWorkspace side="organizer" />}>
              <Route path="collect" element={<CollectStage />} />
              <Route path="analyze" element={<AnalyzeStage />} />
              <Route path="plan" element={<PlanStage />} />
              <Route path="review" element={<OrganizerReviewStage />} />
              <Route path="lock" element={<LockStage />} />
              {/* 未指定 / 未知阶段：TripWorkspace 统一重定向到当前阶段 */}
              <Route index element={null} />
              <Route path="*" element={null} />
            </Route>
          </Route>

          {/* ── 成员端 ── */}
          <Route path="/member" element={<MemberLayout />}>
            <Route index element={<MemberTripList />} />
            <Route path="archived" element={<MemberTripList archived />} />
            <Route path="invite" element={<InvitePage />} />
            <Route path="trip/:tripId" element={<TripWorkspace side="member" />}>
              <Route path="preferences" element={<PreferencesStep />} />
              <Route path="review" element={<MemberReviewStep />} />
              <Route path="confirm" element={<ConfirmStep />} />
              <Route index element={null} />
              <Route path="*" element={null} />
            </Route>
          </Route>

          {/* 异常入口兜底：不出现空白页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TripProvider>
  )
}
