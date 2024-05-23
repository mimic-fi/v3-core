import { deploy, deployProxy, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'

import { itBehavesLikeBalancerV2SwapConnector } from './BalancerV2SwapConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

const BALANCER_V2_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'

const CHAINLINK_USDC_ETH = '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'
const CHAINLINK_WBTC_ETH = '0xdeb288F737066589598e9214E782fa5A8eD689e8'

describe('BalancerV2SwapConnector', () => {
  const SLIPPAGE = 0.09
  const WETH_USDC_POOL_ID = '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019'
  const WETH_WBTC_POOL_ID = '0xa6f548df93de924d73be7d25dc02554c6bd66db500020000000000000000000e'

  before('create balancer v2 swap connector', async function () {
    this.connector = await deploy('BalancerV2SwapConnector', [BALANCER_V2_VAULT])
  })

  before('create price oracle', async function () {
    this.priceOracle = await deployProxy(
      '@mimic-fi/v3-price-oracle/artifacts/contracts/PriceOracle.sol/PriceOracle',
      [],
      [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        WETH,
        [
          { base: USDC, quote: WETH, feed: CHAINLINK_USDC_ETH },
          { base: WBTC, quote: WETH, feed: CHAINLINK_WBTC_ETH },
        ],
      ]
    )
  })

  itBehavesLikeBalancerV2SwapConnector(USDC, WETH, WBTC, WHALE, SLIPPAGE, WETH_USDC_POOL_ID, WETH_WBTC_POOL_ID)
})
