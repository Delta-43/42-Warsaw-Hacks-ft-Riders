import { useCallback, useEffect, useState } from 'react'
import { prefersReducedMotion } from '../Global/playback'
import { SCENARIOS, type Scenario, type TourStep } from './scenarios'

export type DemoTour = {
  scenario: Scenario
  step: TourStep
  stepIndex: number
  /** True while the tour is steering the panels (playing or paused mid-way). */
  controlling: boolean
  finished: boolean
  paused: boolean
  /** Bumps on every (re)start so views can reset themselves. */
  runId: number
  setPaused: (paused: boolean) => void
  replay: () => void
  select: (scenarioId: Scenario['id']) => void
  next: () => void
  prev: () => void
}

export function useDemoTour(enabled: boolean): DemoTour {
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  // People who asked for reduced motion get the tour paused on step 1.
  const [paused, setPaused] = useState(prefersReducedMotion)
  const [runId, setRunId] = useState(0)

  const scenario = SCENARIOS[scenarioIndex]
  const step = scenario.steps[stepIndex]

  useEffect(() => {
    if (!enabled || paused || finished) {
      return
    }
    const timeoutId = window.setTimeout(() => {
      if (stepIndex + 1 < scenario.steps.length) {
        setStepIndex(stepIndex + 1)
      } else {
        setFinished(true)
      }
    }, step.durationMs)
    return () => window.clearTimeout(timeoutId)
  }, [enabled, paused, finished, stepIndex, scenario, step.durationMs])

  const restart = useCallback((nextScenario: number) => {
    setScenarioIndex(nextScenario)
    setStepIndex(0)
    setFinished(false)
    setRunId((id) => id + 1)
  }, [])

  const replay = useCallback(() => {
    restart(scenarioIndex)
    setPaused(false)
  }, [restart, scenarioIndex])

  const select = useCallback(
    (scenarioId: Scenario['id']) => {
      restart(SCENARIOS.findIndex((item) => item.id === scenarioId))
      setPaused(false)
    },
    [restart],
  )

  const next = useCallback(() => {
    setFinished(false)
    setStepIndex((index) => Math.min(index + 1, scenario.steps.length - 1))
  }, [scenario])

  const prev = useCallback(() => {
    setFinished(false)
    setStepIndex((index) => Math.max(index - 1, 0))
  }, [])

  return {
    scenario,
    step,
    stepIndex,
    controlling: enabled && !finished,
    finished,
    paused,
    runId,
    setPaused,
    replay,
    select,
    next,
    prev,
  }
}
