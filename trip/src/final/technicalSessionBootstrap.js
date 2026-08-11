import { createSessionRuntime } from '../../../shared/session-runtime/index.js'

const defaultSessionRuntime = createSessionRuntime()

const membershipBootstrapValue = ({ facts, devAllowMembershipHeader, defaultMembershipId }) => {
  if (!devAllowMembershipHeader) return ''

  if (facts.kind === 'guest') return facts.membershipId
  if (facts.kind === 'account') return facts.membershipId || defaultMembershipId || ''
  return defaultMembershipId || ''
}

const tripBootstrapValue = ({ tripId, devAllowMembershipHeader, defaultTripId }) => (
  tripId || (devAllowMembershipHeader ? defaultTripId || '' : '')
)

export const restoreTripAppBootstrapState = ({
  sessionRuntime = defaultSessionRuntime,
  devAllowMembershipHeader = false,
  defaultMembershipId = '',
  defaultTripId = '',
} = {}) => {
  const { facts, restorationHint } = sessionRuntime.restoreTechnicalSession()

  return {
    hasAccountSession: facts.kind === 'account',
    membershipId: membershipBootstrapValue({ facts, devAllowMembershipHeader, defaultMembershipId }),
    restoredTripId: tripBootstrapValue({
      tripId: restorationHint?.tripId || '',
      devAllowMembershipHeader,
      defaultTripId,
    }),
    activeTripId: tripBootstrapValue({
      tripId: facts.kind === 'guest' ? facts.activeTripId : facts.kind === 'account' ? (facts.activeTripId || '') : '',
      devAllowMembershipHeader,
      defaultTripId,
    }),
  }
}
