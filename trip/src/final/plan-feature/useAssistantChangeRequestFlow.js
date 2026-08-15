import { useEffect, useMemo, useRef, useState } from 'react'
import { useTripApp } from '../TripAppState.jsx'
import { trip } from '../tripContent.js'
import { serializeWorkspaceRoute } from '../../../../shared/trip-navigation-route/index.js'

const tripHref = (tripId, section) => serializeWorkspaceRoute({ kind: 'trip', tripId, section })

// Only these three fields can move a block, and a round settles exactly one
// item, so anything aimed elsewhere is dropped here as well as on the server.
const roundAlternativesFrom = (candidateOptions, targetItemId) =>
  (candidateOptions || [])
    .filter(option => option.item_id === targetItemId && option.patch)
    .map(option => ({
      item_id: option.item_id,
      label: option.label || '',
      title: option.title || '',
      body: option.body || '',
      tradeoff: option.tradeoff || '',
      start_hour: option.patch.start_hour ?? null,
      day_date: option.patch.day_date ?? null,
      duration_min: option.patch.duration_min ?? null,
    }))
    .filter(option =>
      option.start_hour !== null || option.day_date !== null || option.duration_min !== null,
    )

const ASSISTANT_LOADING_MESSAGES = [
  'Reviewing the itinerary...',
  'Checking the proposed change...',
  'Looking for member impact...',
  'Organizing the options...',
]

const assistantErrorText = err => (
  err.status === 409
    ? 'A vote is already open for this time block.'
    : err.status === 422
      ? 'Reopening this block needs a written reason.'
      : 'I could not reach the backend. Try again in a moment.'
)

const hasExecutablePatch = option => Boolean(option?.patch && Object.keys(option.patch).length)

const historyTurnFromMessage = message => {
  const turn = {
    role: message.from === 'you' ? 'user' : 'assistant',
    text: message.text,
  }
  if (message.from !== 'you' && Array.isArray(message.candidateOptions) && message.candidateOptions.length) {
    turn.candidate_options = message.candidateOptions.map(option => ({
      id: option.id,
      label: option.label || '',
      title: option.title || '',
      body: option.body || '',
      tradeoff: option.tradeoff || '',
      item_id: option.item_id,
      patch: option.patch || {},
    }))
  }
  return turn
}

export function useAssistantChangeRequestFlow({ item, mode, onCommand, onResolvedOutcome }) {
  const app = useTripApp()
  const [pendingRedirect, setPendingRedirect] = useState('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const threadRef = useRef(null)
  const inputRef = useRef(null)

  const promptExamples = {
    global: '',
    ask: '',
    editTime: '',
    moveDay: '',
    replacePlace: '',
    removePlan: '',
    details: '',
  }

  const placeholder = mode === 'global'
    ? 'Ask Cadensy or request a change...'
    : 'Ask about this item or request a change...'

  const itemId = mode === 'global' ? null : item.id
  const itemById = useMemo(() => Object.fromEntries((app.days || []).flatMap(day => day.items.map(planItem => [planItem.id, planItem]))), [app.days])

  useEffect(() => {
    setDraft(promptExamples[mode] || '')
    setMessages([])
    setPendingRedirect('')
    setSending(false)
    setLoadingStep(0)
  }, [item.id, mode])

  useEffect(() => {
    if (!sending) return undefined
    // Local placeholder rotation only. Real progress events need a later SSE/API stream.
    const interval = window.setInterval(() => {
      setLoadingStep(step => step + 1)
    }, 2600)
    return () => window.clearInterval(interval)
  }, [sending])

  useEffect(() => {
    setMessages(current => current.map(message => message.loading
      ? { ...message, text: ASSISTANT_LOADING_MESSAGES[loadingStep % ASSISTANT_LOADING_MESSAGES.length] }
      : message))
  }, [loadingStep])

  useEffect(() => {
    const thread = threadRef.current
    if (thread) thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })
  }, [messages, pendingRedirect])

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80)
  }, [item.id, mode])

  const updateMessage = (id, patch) => {
    setMessages(current => current.map(message => message.id === id ? { ...message, ...patch } : message))
  }

  const sendMessage = async () => {
    const text = draft.trim()
    if (!text || sending) return
    const loadingId = `ai-loading-${Date.now()}`
    const userMessage = { id: `user-${Date.now()}`, from: 'you', text }
    setLoadingStep(0)
    setMessages(current => [...current, userMessage, { id: loadingId, from: 'tripSync', text: ASSISTANT_LOADING_MESSAGES[0], loading: true }])
    setDraft('')
    setSending(true)
    try {
      const history = messages
        .filter(message => !message.loading && message.text)
        .map(historyTurnFromMessage)
      const result = await app.chatWithTrip({ message: text, itemId, history })
      const candidateOptions = Array.isArray(result.candidate_options) ? result.candidate_options : []
      setMessages(current => current.map(message => message.id === loadingId ? {
        ...message,
        loading: false,
        from: 'tripSync',
        text: result.reply,
        proposedChange: result.proposed_change,
        candidateOptions,
        selectedCandidateId: '',
        request: text,
        applyError: '',
        selectionNote: '',
        classifyingCandidate: false,
      } : message))
    } catch (err) {
      const text = assistantErrorText(err)
      setMessages(current => current.map(message => message.id === loadingId ? { ...message, text, loading: false, error: true } : message))
    } finally {
      setSending(false)
    }
  }

  const dismissProposal = id => updateMessage(id, { proposedChange: null, applyError: '', selectionNote: '' })

  const selectCandidateOption = async (message, option) => {
    const targetItem = itemById[option.item_id] || (item.id === option.item_id ? item : null)
    if (!targetItem) {
      updateMessage(message.id, {
        selectedCandidateId: option.id,
        proposedChange: null,
        classifyingCandidate: false,
        selectionNote: '',
        applyError: 'That option is no longer available from the current plan.',
      })
      return
    }

    updateMessage(message.id, {
      selectedCandidateId: option.id,
      proposedChange: null,
      applied: false,
      applyError: '',
      selectionNote: '',
      classifyingCandidate: hasExecutablePatch(option),
    })

    if (!hasExecutablePatch(option)) {
      updateMessage(message.id, {
        classifyingCandidate: false,
        selectionNote: 'That option keeps the Current Plan as-is.',
      })
      return
    }

    try {
      const verdict = await app.classify({
        item: targetItem,
        actionType: mode,
        request: message.request,
        patch: option.patch || {},
      })
      updateMessage(message.id, {
        classifyingCandidate: false,
        proposedChange: {
          item_id: option.item_id,
          item_title: targetItem.title || option.title,
          patch: option.patch || {},
          verdict,
        },
      })
    } catch (err) {
      updateMessage(message.id, {
        classifyingCandidate: false,
        proposedChange: null,
        applyError: assistantErrorText(err),
      })
    }
  }

  const applyProposal = async (message, proposedChange) => {
    const targetItem = itemById[proposedChange.item_id] || (item.id === proposedChange.item_id ? item : { id: proposedChange.item_id, title: proposedChange.item_title })
    updateMessage(message.id, { applying: true, applyError: '' })
    try {
      const outcome = await app.submitChange({
        item: targetItem,
        actionType: mode,
        request: message.request,
        verdict: proposedChange.verdict,
        patch: proposedChange.patch,
        options: roundAlternativesFrom(message.candidateOptions, targetItem.id),
      })
      if (!outcome) {
        updateMessage(message.id, { applying: false })
        return
      }
      updateMessage(message.id, { applying: false, applied: true })
      if (outcome.path === 'notice') {
        app.notify('Updated')
        onResolvedOutcome?.({ kind: 'focus-item', itemId: targetItem.id, outcome, targetItem })
      } else if (outcome.path === 'round' || outcome.path === 'reopen_round') {
        app.notify('Vote opened')
        onResolvedOutcome?.({ kind: 'focus-round', itemId: targetItem.id, outcome, targetItem })
      } else {
        setPendingRedirect('Affected members need to confirm. Opening the conversation...')
        const tripId = app.activeTripId || app.trip?.id || trip?.id
        if (tripId) onCommand?.({ type: 'navigate', to: tripHref(tripId, 'conflict'), delayMs: 850 })
      }
    } catch (err) {
      const applyError = assistantErrorText(err)
      updateMessage(message.id, { applying: false, applyError })
    }
  }

  return {
    view: {
      pendingRedirect,
      draft,
      messages,
      sending,
      placeholder,
      itemById,
      threadRef,
      inputRef,
    },
    actions: {
      updateDraft: setDraft,
      sendMessage,
      dismissProposal,
      selectCandidateOption,
      applyProposal,
    },
  }
}
