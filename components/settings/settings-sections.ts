export const SETTINGS_SECTIONS = [
  {
    id: 'account',
    label: 'Account',
    description: 'Your profile, email address and workspace.',
    keywords: 'profile name email verify projects',
  },
  {
    id: 'security',
    label: 'Sign-in & security',
    description: 'Keep access to your account secure.',
    keywords: 'password reset login google github provider authentication',
  },
  {
    id: 'privacy',
    label: 'Privacy & data',
    description: 'Choose your cookie preferences and manage your data.',
    keywords:
      'cookies analytics functional consent erasure delete account privacy',
  },
  {
    id: 'usage',
    label: 'Usage',
    description: 'Your current usage, limits and reset periods.',
    keywords: 'limits tokens credits allowance consumed reserved refresh',
  },
  {
    id: 'billing',
    label: 'Plan & billing',
    description: 'Your subscription and billing details.',
    keywords:
      'payment invoice subscription plan pricing upgrade cancel billing',
  },
] as const

export type SettingsPage = (typeof SETTINGS_SECTIONS)[number]['id']
export function settingsPage(value: string | null): SettingsPage {
  return (
    SETTINGS_SECTIONS.find((section) => section.id === value)?.id ?? 'account'
  )
}
export function filterSettings(query: string) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return SETTINGS_SECTIONS.filter((section) =>
    words.every((word) =>
      `${section.label} ${section.description} ${section.keywords}`
        .toLocaleLowerCase()
        .includes(word),
    ),
  )
}

/** A finished request must not put feedback on a different account or section. */
export function canShowSettingsFeedback(
  origin: { uid: string | undefined; section: SettingsPage },
  current: { uid: string | undefined; section: SettingsPage },
): boolean {
  return (
    Boolean(origin.uid) &&
    origin.uid === current.uid &&
    origin.section === current.section
  )
}
