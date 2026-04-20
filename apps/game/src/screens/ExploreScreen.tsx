import { PlaysetBoard } from 'playsets'

export function ExploreScreen() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PlaysetBoard mode="explore" roomId="explore" seed={1n} />
    </div>
  )
}
