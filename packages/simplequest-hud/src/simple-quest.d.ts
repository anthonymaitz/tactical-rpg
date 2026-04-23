declare module 'simple-quest' {
  export type CombatState = 'inGeneral' | 'inCombat' | 'outOfCombat'

  export interface CombatStatus {
    id: CombatState
    label: string
    message: string
  }

  export interface AbilityCard {
    title: string
    body: string
    context: CombatState
    source: string
    energyCost?: number
  }

  export interface SimpleQuestContent {
    personalities: string[]
    classes: string[]
    professions: string[]
    statuses: CombatStatus[]
    abilities: AbilityCard[]
    descriptions: Record<string, string>
    generalContent: string
    deathContent: string
  }

  export interface CharacterData {
    name: string
    personality: string
    class: string
    profession: string
    combat: CombatState
    energy: boolean[]
    hp: number
    die: string
  }

  export const sampleContent: SimpleQuestContent
}
