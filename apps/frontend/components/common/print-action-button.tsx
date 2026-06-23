import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function PrintActionButton({
  children = 'In',
  onClick,
  disabled,
}: {
  children?: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled}>
      <Printer className="h-4 w-4" />
      {children}
    </Button>
  )
}
