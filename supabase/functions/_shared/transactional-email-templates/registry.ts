/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeSignup } from './welcome-signup.tsx'
import { template as activationConfirmation } from './activation-confirmation.tsx'
import { template as creditPurchaseReceipt } from './credit-purchase-receipt.tsx'
import { template as lowCreditsWarning } from './low-credits-warning.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-signup': welcomeSignup,
  'activation-confirmation': activationConfirmation,
  'credit-purchase-receipt': creditPurchaseReceipt,
  'low-credits-warning': lowCreditsWarning,
}
