interface ConnectScreenProps {
  onConnect: () => void
}

export function ConnectScreen({ onConnect }: ConnectScreenProps) {
  return (
    <div>
      <h1>Tactical RPG</h1>
      <button onClick={onConnect}>Connect</button>
    </div>
  )
}
