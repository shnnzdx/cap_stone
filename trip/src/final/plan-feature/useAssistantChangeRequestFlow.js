import { useEffect, useMemo, useRef, useState } from 'react'
import { useTripApp } from '../TripAppState.jsx'
import { trip } from '../tripContent.js'
import { serializeWorkspaceRoute } from '../../../../shared/trip-navigation-route/index.js'

const tripHref = (tripId, section) => serializeWorkspaceRoute({ kind: 'trip', tripId, section })

const ASSISTANT_LOADING_MESSAGES = [
  'Reviewing the itinerary...',
  'Checking the proposed change...',
  'Looking for member impact...',
  'Organizing the options...',
]

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
        .map(message => ({
          role: message.from === 'you' ? 'user' : 'assistant',
          text: message.text,
        }))
      const result = await app.chatWithTrip({ message: text, itemId, history })
      const candidateOptions = Array.isArray(result.candidate_options) ? result.candidate_options : []
      setMessages(current => current.map(message => message.id === loadingId ? {
        ...message,
        loading: false,
        from: 'tripSync',
        text: result.reply,
        proposedChange: result.proposed_change,
        candidateOptions,
        selectedCandidateId: candidateOptions[0]?.id || '',
        request: text,
      } : message))
    } catch (err) {
      const text = err.status === 409
        ? 'A vote is already open for this time block.'
        : err.status === 422
          ? 'Reopening this block needs a written reason.'
          : 'I could not reach the backend. Try again in a moment.'
      setMessages(current => current.map(message => message.id === loadingId ? { ...message, text, loading: false, error: true } : message))
    } finally {
      setSending(false)
    }
  }

  const dismissProposal = id => updateMessage(id, { proposedChange: null })

  const selectCandidateOption = (message, option) => {
    const targetItem = itemById[option.item_id] || (item.id === option.item_id ? item : null)
    updateMessage(message.id, {
      selectedCandidateId: option.id,
      proposedChange: {
        ...(message.proposedChange || {}),
        item_id: option.item_id,
        item_title: targetItem?.title || message.proposedChange?.item_title || option.title,
        patch: option.patch || {},
        verdict: message.proposedChange?.verdict,
      },
      applied: false,
      applyError: '',
    })
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
      const applyError = err.status === 409
        ? 'A vote is already open for this time block.'
        : err.status === 422
          ? 'Reopening this block needs a written reason.'
          : 'I could not reach the backend. Try again in a moment.'
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
