export const navigation = { pushes: [] as string[], search: new URLSearchParams('organisation=org1&token=' + 'a'.repeat(43)) }
export const useRouter = () => ({ push: (href: string) => { navigation.pushes.push(href) }, replace: (href: string) => { navigation.pushes.push(href) }, refresh: () => undefined })
export const useSearchParams = () => navigation.search
export const setInvitationQuery = (organisation: string, token: string) => { navigation.search = new URLSearchParams({ organisation, token }) }
export const usePathname = () => '/invitations/accept'
