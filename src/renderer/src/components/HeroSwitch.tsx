import React from 'react'
import { Label, Switch } from '@heroui/react'

type HeroSwitchProps = {
  children: React.ReactNode
  isSelected: boolean
  isDisabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  onChange: (selected: boolean) => void
}

export function HeroSwitch({
  children,
  isSelected,
  isDisabled,
  size = 'md',
  onChange
}: HeroSwitchProps): React.JSX.Element {
  return (
    <Switch isSelected={isSelected} isDisabled={isDisabled} size={size} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>{children}</Label>
      </Switch.Content>
    </Switch>
  )
}
