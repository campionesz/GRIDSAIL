import { zeroAddress, type Address } from 'viem'

const deployedAddress = ''
const configuredAddress = import.meta.env.VITE_GRIDSAIL_CONTRACT_ADDRESS
const activeAddress = configuredAddress || deployedAddress

export const isContractConfigured =
  /^0x[a-fA-F0-9]{40}$/.test(activeAddress) &&
  activeAddress.toLowerCase() !== zeroAddress

export const GRIDSAIL_ADDRESS = (
  isContractConfigured ? activeAddress : zeroAddress
) as Address

export const gridsailAbi = [
  {
    type: 'function',
    name: 'sail',
    inputs: [{ name: 'direction', type: 'uint8' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'voyageOf',
    inputs: [{ name: 'day', type: 'uint64' }],
    outputs: [
      { name: 'shipX', type: 'uint8' },
      { name: 'shipY', type: 'uint8' },
      { name: 'beaconX', type: 'uint8' },
      { name: 'beaconY', type: 'uint8' },
      { name: 'docks', type: 'uint16' },
      { name: 'moves', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'statsOf',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: 'stats',
        type: 'tuple',
        components: [
          { name: 'totalMoves', type: 'uint64' },
          { name: 'totalDocks', type: 'uint32' },
          { name: 'lastActiveDay', type: 'uint64' },
          { name: 'todayMoves', type: 'uint8' },
          { name: 'lastDirection', type: 'uint8' },
          { name: 'lastSailedAt', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'globalMoves',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'globalDocks',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
  },
] as const
