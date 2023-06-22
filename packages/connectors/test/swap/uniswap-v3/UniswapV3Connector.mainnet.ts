import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeUniswapV3Connector } from './UniswapV3Connector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

const CHAINLINK_USDC_ETH = '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'
const CHAINLINK_WBTC_ETH = '0xdeb288F737066589598e9214E782fa5A8eD689e8'

describe('UniswapV3Connector', () => {
  const SLIPPAGE = 0.02
  const WETH_USDC_FEE = 3000
  const WETH_WBTC_FEE = 3000

  before('create uniswap v3 connector', async function () {
    this.connector = await deploy('UniswapV3Connector', [UNISWAP_V3_ROUTER])
  })

  itBehavesLikeUniswapV3Connector(
    USDC,
    WETH,
    WBTC,
    WHALE,
    SLIPPAGE,
    WETH_USDC_FEE,
    WETH_WBTC_FEE,
    CHAINLINK_USDC_ETH,
    CHAINLINK_WBTC_ETH
  )
})
