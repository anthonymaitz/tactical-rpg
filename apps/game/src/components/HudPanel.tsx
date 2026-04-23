import { SimpleQuestHUD } from 'simplequest-hud'

interface HudPanelProps {
  content: string
  character?: string
}

export function HudPanel(props: HudPanelProps) {
  return <SimpleQuestHUD content={props.content} character={props.character} />
}
