import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Compass,
  ExternalLink,
  LoaderCircle,
  LogOut,
  Map,
  RadioTower,
  RefreshCw,
  Sailboat,
  Wallet,
  Waves,
  X,
} from 'lucide-react'
import { concatHex, encodeFunctionData } from 'viem'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { base } from 'wagmi/chains'
import {
  GRIDSAIL_ADDRESS,
  gridsailAbi,
  isContractConfigured,
} from './config/contract'
import { DATA_SUFFIX } from './config/wagmi'

const GRID_SIZE = 9
const DAILY_LIMIT = 5
const SAMPLE_VOYAGE = [2, 6, 7, 2, 3, 28] as const
const DIRECTIONS = [
  { label: 'NORTH', short: 'N', dx: 0, dy: -1, icon: ArrowUp },
  { label: 'EAST', short: 'E', dx: 1, dy: 0, icon: ArrowRight },
  { label: 'SOUTH', short: 'S', dx: 0, dy: 1, icon: ArrowDown },
  { label: 'WEST', short: 'W', dx: -1, dy: 0, icon: ArrowLeft },
] as const

type Profile = readonly [bigint, number, bigint, number, number, bigint]
type Voyage = readonly [number, number, number, number, number, bigint]

function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
}

function friendlyError(error: unknown) {
  if (!(error instanceof Error)) return 'Course change failed.'
  const message = error.message.toLowerCase()
  if (message.includes('user rejected') || message.includes('user denied')) {
    return 'Transaction cancelled in the wallet.'
  }
  if (message.includes('dailylimitreached')) {
    return 'Your five daily course changes are already used.'
  }
  if (message.includes('insufficient funds')) {
    return 'Not enough ETH on Base to cover gas.'
  }
  return error.message.split('\n')[0]
}

function MapGrid({
  shipX,
  shipY,
  beaconX,
  beaconY,
  nextX,
  nextY,
}: {
  shipX: number
  shipY: number
  beaconX: number
  beaconY: number
  nextX: number
  nextY: number
}) {
  const cells = useMemo(
    () => Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
      x: index % GRID_SIZE,
      y: Math.floor(index / GRID_SIZE),
    })),
    [],
  )

  return (
    <div className="sea-map" aria-label="Shared navigation grid">
      <div className="map-axis map-axis--top">
        {Array.from({ length: GRID_SIZE }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
      <div className="map-axis map-axis--side">
        {Array.from({ length: GRID_SIZE }, (_, index) => (
          <span key={index}>{String.fromCharCode(65 + index)}</span>
        ))}
      </div>
      <div className="map-grid">
        {cells.map(({ x, y }) => {
          const ship = x === shipX && y === shipY
          const beacon = x === beaconX && y === beaconY
          const predicted = x === nextX && y === nextY && !ship
          return (
            <div
              className={`map-cell ${predicted ? 'map-cell--predicted' : ''}`}
              key={`${x}-${y}`}
            >
              {predicted && <span className="wake-dot" />}
              {beacon && (
                <span className="beacon-marker" title="Daily lighthouse">
                  <RadioTower aria-hidden="true" />
                  <i />
                </span>
              )}
              {ship && (
                <span className="ship-marker" title="Community ship">
                  <Sailboat aria-hidden="true" />
                </span>
              )}
            </div>
          )
        })}
      </div>
      <span className="chart-note chart-note--one">CURRENT 02</span>
      <span className="chart-note chart-note--two">DEPTH 8453</span>
    </div>
  )
}

export function App() {
  const [direction, setDirection] = useState(1)
  const [walletOpen, setWalletOpen] = useState(false)
  const [localError, setLocalError] = useState('')
  const [notice, setNotice] = useState('')
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connect, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const {
    data: transactionHash,
    error: sendError,
    isPending: isSending,
    sendTransactionAsync,
  } = useSendTransaction()

  const currentDay = BigInt(Math.floor(Date.now() / 86_400_000))
  const voyageRead = useReadContract({
    address: GRIDSAIL_ADDRESS,
    abi: gridsailAbi,
    functionName: 'voyageOf',
    args: [currentDay],
    query: { enabled: isContractConfigured },
  })
  const profileRead = useReadContract({
    address: GRIDSAIL_ADDRESS,
    abi: gridsailAbi,
    functionName: 'statsOf',
    args: address ? [address] : undefined,
    query: { enabled: isContractConfigured && Boolean(address) },
  })
  const globalMovesRead = useReadContract({
    address: GRIDSAIL_ADDRESS,
    abi: gridsailAbi,
    functionName: 'globalMoves',
    query: { enabled: isContractConfigured },
  })
  const globalDocksRead = useReadContract({
    address: GRIDSAIL_ADDRESS,
    abi: gridsailAbi,
    functionName: 'globalDocks',
    query: { enabled: isContractConfigured },
  })
  const receipt = useWaitForTransactionReceipt({
    hash: transactionHash,
    query: { enabled: Boolean(transactionHash) },
  })

  const voyage = (
    isContractConfigured && voyageRead.data
      ? voyageRead.data
      : SAMPLE_VOYAGE
  ) as Voyage
  const profile = profileRead.data as Profile | undefined
  const [shipX, shipY, beaconX, beaconY] = voyage.map(Number)
  const voyageDocks = Number(voyage[4])
  const voyageMoves = Number(voyage[5])
  const todayMoves = Number(profile?.[3] ?? 0)
  const totalMoves = Number(profile?.[0] ?? 0n)
  const remaining = Math.max(DAILY_LIMIT - todayMoves, 0)
  const chosenDirection = DIRECTIONS[direction]
  const nextX = (shipX + chosenDirection.dx + GRID_SIZE) % GRID_SIZE
  const nextY = (shipY + chosenDirection.dy + GRID_SIZE) % GRID_SIZE
  const distance =
    Math.min(Math.abs(shipX - beaconX), GRID_SIZE - Math.abs(shipX - beaconX)) +
    Math.min(Math.abs(shipY - beaconY), GRID_SIZE - Math.abs(shipY - beaconY))
  const isBusy = isSending || receipt.isLoading
  const transactionError = localError || (sendError ? friendlyError(sendError) : '')

  const refresh = async () => {
    await Promise.all([
      voyageRead.refetch(),
      profileRead.refetch(),
      globalMovesRead.refetch(),
      globalDocksRead.refetch(),
    ])
  }

  useEffect(() => {
    if (!receipt.isSuccess) return
    setNotice('Course recorded. The shared ship has moved.')
    void refresh()
  }, [receipt.isSuccess])

  const changeCourse = async () => {
    setLocalError('')
    setNotice('')
    if (!isContractConfigured) {
      setLocalError('Add the deployed contract address in src/config/contract.ts.')
      return
    }
    if (!isConnected) {
      setWalletOpen(true)
      return
    }
    if (remaining === 0) {
      setLocalError('Your five daily course changes are already used.')
      return
    }

    try {
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id })
      const callData = encodeFunctionData({
        abi: gridsailAbi,
        functionName: 'sail',
        args: [direction],
      })
      await sendTransactionAsync({
        to: GRIDSAIL_ADDRESS,
        data: concatHex([callData, DATA_SUFFIX]),
        chainId: base.id,
      })
    } catch (error) {
      setLocalError(friendlyError(error))
    }
  }

  const connectWallet = (connector: (typeof connectors)[number]) => {
    connect(
      { connector, chainId: base.id },
      {
        onSuccess: () => setWalletOpen(false),
        onError: (error) => setLocalError(friendlyError(error)),
      },
    )
  }

  return (
    <div className="app">
      <header>
        <a className="brand" href="/">
          <img src="/gridsail-mark.svg" alt="" />
          <span>GRIDSAIL</span>
        </a>
        <div className="header-status">
          <span><i /> BASE MAINNET</span>
          <button onClick={() => setWalletOpen(true)}>
            <Wallet size={18} />
            {isConnected ? shortAddress(address) : 'CONNECT'}
          </button>
        </div>
      </header>

      {!isContractConfigured && (
        <div className="setup-banner">
          <Map size={18} />
          <strong>CHART PREVIEW</strong>
          <span>Add the deployed address in src/config/contract.ts</span>
        </div>
      )}

      <main>
        <section className="mission-strip">
          <div>
            <span className="kicker">DAILY COMMUNITY VOYAGE</span>
            <h1>STEER THE<br />SHARED SHIP.</h1>
          </div>
          <p>
            Choose one direction. Your onchain move changes the course for
            every sailor who arrives after you.
          </p>
          <div className="mission-number">
            <span>UTC CHART</span>
            <strong>{currentDay.toString()}</strong>
          </div>
        </section>

        <section className="navigation-layout">
          <div className="map-panel">
            <div className="panel-heading">
              <div>
                <Compass size={22} />
                <span>LIVE NAVIGATION CHART</span>
              </div>
              <span className="live-pill">LIVE</span>
            </div>
            <MapGrid
              shipX={shipX}
              shipY={shipY}
              beaconX={beaconX}
              beaconY={beaconY}
              nextX={nextX}
              nextY={nextY}
            />
            <div className="map-legend">
              <span><Sailboat size={18} /> COMMUNITY SHIP</span>
              <span><RadioTower size={18} /> NEXT LIGHTHOUSE</span>
              <span><i className="legend-wake" /> SELECTED MOVE</span>
            </div>
          </div>

          <aside className="helm">
            <div className="helm-heading">
              <span>COURSE CONTROL</span>
              <strong>{chosenDirection.short}</strong>
            </div>
            <div className="coordinates">
              <div><span>SHIP</span><strong>{String.fromCharCode(65 + shipY)}{shipX + 1}</strong></div>
              <ChevronRight />
              <div><span>NEXT</span><strong>{String.fromCharCode(65 + nextY)}{nextX + 1}</strong></div>
            </div>
            <div className="compass-control">
              {DIRECTIONS.map((item, index) => {
                const Icon = item.icon
                return (
                  <button
                    className={`course-${item.short.toLowerCase()} ${direction === index ? 'selected' : ''}`}
                    key={item.label}
                    onClick={() => setDirection(index)}
                    title={item.label}
                    aria-label={`Sail ${item.label.toLowerCase()}`}
                  >
                    <Icon />
                    <span>{item.short}</span>
                  </button>
                )
              })}
              <div className="compass-center"><Compass /></div>
            </div>
            <div className="move-meter">
              <span>YOUR DAILY SIGNALS</span>
              <div>
                {Array.from({ length: DAILY_LIMIT }, (_, index) => (
                  <i className={index < todayMoves ? 'used' : ''} key={index} />
                ))}
              </div>
              <strong>{remaining} REMAINING</strong>
            </div>
            <button
              className="sail-button"
              disabled={isBusy || (isConnected && remaining === 0)}
              onClick={changeCourse}
            >
              {isBusy ? <LoaderCircle className="spin" /> : <Waves />}
              {isBusy
                ? isSending ? 'CONFIRM IN WALLET' : 'CROSSING THE WATER'
                : isConnected ? `SAIL ${chosenDirection.label}` : 'CONNECT TO TAKE THE HELM'}
            </button>
            {transactionError && <p className="message error">{transactionError}</p>}
            {notice && (
              <p className="message success">
                <Check size={16} /> {notice}
                {transactionHash && (
                  <a href={`https://basescan.org/tx/${transactionHash}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                  </a>
                )}
              </p>
            )}
          </aside>
        </section>

        <section className="logbook">
          <div><span>LIGHTHOUSE RANGE</span><strong>{distance}</strong><small>grid steps</small></div>
          <div><span>TODAY&apos;S MOVES</span><strong>{voyageMoves}</strong><small>shared course</small></div>
          <div><span>TODAY&apos;S DOCKS</span><strong>{voyageDocks}</strong><small>ports reached</small></div>
          <div><span>YOUR LOGBOOK</span><strong>{totalMoves}</strong><small>lifetime moves</small></div>
          <button onClick={() => void refresh()} title="Refresh onchain chart"><RefreshCw /></button>
        </section>

        <section className="rules-band">
          <span>ONE SHIP</span><i />
          <span>FIVE MOVES DAILY</span><i />
          <span>NO TOKEN OR WAGER</span><i />
          <span>ONLY BASE GAS</span>
        </section>
      </main>

      <footer>
        <span>GRIDSAIL / COOPERATIVE NAVIGATION</span>
        <span>THE SEA WRAPS AT EVERY EDGE</span>
      </footer>

      {walletOpen && (
        <div className="modal-backdrop" onMouseDown={() => setWalletOpen(false)}>
          <div className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setWalletOpen(false)} aria-label="Close"><X /></button>
            <span className="kicker">BOARD THE SHIP</span>
            <h2 id="wallet-title">{isConnected ? 'SAILOR CONNECTED' : 'CHOOSE A WALLET'}</h2>
            <p>Connect on Base Mainnet to change the shared course.</p>
            {isConnected ? (
              <>
                <div className="connected-wallet"><i /><strong>{shortAddress(address)}</strong><small>Base Mainnet</small></div>
                <button className="disconnect" onClick={() => { disconnect(); setWalletOpen(false) }}><LogOut /> DISCONNECT</button>
              </>
            ) : (
              <div className="wallet-options">
                {connectors.map((connector) => {
                  const isBase = connector.name.toLowerCase().includes('base')
                  return (
                    <button key={connector.uid} disabled={isConnecting} onClick={() => connectWallet(connector)}>
                      <span className={isBase ? 'wallet-logo base-logo' : 'wallet-logo'}>{isBase ? 'B' : <Wallet />}</span>
                      <span><strong>{isBase ? 'Base Account' : 'Browser Wallet'}</strong><small>{isBase ? 'Coinbase smart wallet' : 'MetaMask, Rabby and more'}</small></span>
                      <ChevronRight />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
