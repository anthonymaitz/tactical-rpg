import { PlaysetBoard } from 'playsets'

interface ExploreScreenProps {
  token?: string | null
  heroIds?: string[]
}

export function ExploreScreen({ token: _token, heroIds: _heroIds }: ExploreScreenProps = {}) {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PlaysetBoard mode="explore" roomId="explore" seed={1n} />
    </div>
  )
}
