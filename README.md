# GRIDSAIL

GRIDSAIL is a shared daily navigation game on Base. Every wallet can steer the
community ship up to five times per UTC day. There is no token, wager, prize,
or app fee.

## Deploy

1. Open `contracts/GridSail.sol` in Remix.
2. Compile with Solidity `0.8.24` or newer.
3. Deploy on Base Mainnet.
4. Add the address to `src/config/contract.ts`.
5. Replace `bc_replace_me` in `src/config/wagmi.ts` with your Builder Code.

Builder attribution is appended directly to transaction calldata for reliable
tracking across Base Account, MetaMask, and Rabby.

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `20`
