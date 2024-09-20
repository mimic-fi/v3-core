import { deploy, deployProxy, ZERO_ADDRESS } from '@mimic-fi/helpers'

import { itBehavesLikeBalancerV2SwapConnector } from './BalancerV2SwapConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
const WETH = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'
const WBTC = '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f'
const WHALE = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'

const BALANCER_V2_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'

const CHAINLINK_ETH_USD = '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612'
const CHAINLINK_BTC_USD = '0x6ce185860a4963106506c203335a2910413708e9'

describe('BalancerV2SwapConnector', () => {
  const SLIPPAGE = 0.05
  const WETH_USDC_POOL_ID = '0x64541216bafffeec8ea535bb71fbc927831d0595000100000000000000000002'
  const WETH_WBTC_POOL_ID = '0x64541216bafffeec8ea535bb71fbc927831d0595000100000000000000000002'

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
        USDC,
        [
          { base: WETH, quote: USDC, feed: CHAINLINK_ETH_USD },
          { base: WBTC, quote: USDC, feed: CHAINLINK_BTC_USD },
        ],
      ]
    )
  })

  itBehavesLikeBalancerV2SwapConnector(USDC, WETH, WBTC, WHALE, SLIPPAGE, WETH_USDC_POOL_ID, WETH_WBTC_POOL_ID)
})
