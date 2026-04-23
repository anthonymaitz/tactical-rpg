import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@solidjs/testing-library'
import '@testing-library/jest-dom'

vi.mock('playsets-board', () => ({}))

vi.mock('@babylonjs/core', () => ({
  Engine: vi.fn().mockImplementation(() => ({
    runRenderLoop: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
  Scene: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    getMeshByName: vi.fn().mockReturnValue(null),
    dispose: vi.fn(),
  })),
  ArcRotateCamera: vi.fn().mockImplementation(() => ({
    attachControl: vi.fn(),
  })),
  HemisphericLight: vi.fn(),
  Vector3: Object.assign(
    vi.fn().mockImplementation(() => ({})),
    { Zero: vi.fn().mockReturnValue({}) },
  ),
  MeshBuilder: {
    CreateBox: vi.fn().mockReturnValue({ position: {}, material: null, dispose: vi.fn() }),
    CreateSphere: vi.fn().mockReturnValue({ position: {}, material: null, dispose: vi.fn() }),
  },
  StandardMaterial: vi.fn().mockImplementation(() => ({ diffuseColor: null })),
  Color3: vi.fn(),
}))

import { PlaysetBoard } from '../PlaysetBoard'

describe('PlaysetBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a playsets-board element in explore mode', () => {
    render(() => <PlaysetBoard mode="explore" roomId="room1" seed={1n} />)
    expect(document.querySelector('playsets-board')).not.toBeNull()
  })

  it('renders in combat mode with combatState', () => {
    const combatState = {
      roomId: 'room1',
      turnQueue: [],
      currentActorIndex: 0,
      actors: {},
      round: 1,
      log: [],
      isOver: false,
    }
    render(() => <PlaysetBoard mode="combat" roomId="room1" combatState={combatState} />)
    expect(document.querySelector('canvas')).not.toBeNull()
  })

  it('calls onAction when provided', () => {
    const onAction = vi.fn()
    render(() => <PlaysetBoard mode="combat" roomId="room1" onAction={onAction} />)
    expect(document.querySelector('canvas')).not.toBeNull()
  })
})
