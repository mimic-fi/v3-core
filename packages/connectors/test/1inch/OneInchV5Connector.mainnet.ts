import { deploy } from '@mimic-fi/helpers'

import { itBehavesLikeOneInchV5Connector } from './OneInchV5Connector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 1

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

const ONE_INCH_V5_ROUTER = '0x1111111254EEB25477B68fb85Ed929f73A960582'

const CHAINLINK_USDC_ETH = '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'
const CHAINLINK_WBTC_ETH = '0xdeb288F737066589598e9214E782fa5A8eD689e8'

describe('OneInchV5Connector', () => {
  const SLIPPAGE = 0.015

  before('create 1inch v5 connector', async function () {
    this.connector = await deploy('OneInchV5Connector', [ONE_INCH_V5_ROUTER])
  })

  itBehavesLikeOneInchV5Connector(CHAIN, USDC, WETH, WBTC, WHALE, SLIPPAGE, CHAINLINK_USDC_ETH, CHAINLINK_WBTC_ETH)
})
