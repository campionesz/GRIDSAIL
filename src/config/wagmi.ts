import { QueryClient } from '@tanstack/react-query'
import { Attribution } from 'ox/erc8021'
import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { baseAccount, injected } from 'wagmi/connectors'

export const BUILDER_CODE =
  import.meta.env.VITE_BUILDER_CODE || 'bc_replace_me'

export const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: [BUILDER_CODE],
})

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount({ appName: 'GRIDSAIL' }),
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
  },
})

export const queryClient = new QueryClient()

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
