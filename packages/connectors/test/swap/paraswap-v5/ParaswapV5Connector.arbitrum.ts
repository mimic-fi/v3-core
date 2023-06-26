import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeParaswapV5Connector } from './ParaswapV5Connector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 42161

const USDC = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
const WETH = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'
const WBTC = '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f'
const WHALE = '0xba12222222228d8ba445958a75a0704d566bf2c8'

const PARASWAP_V5_AUGUSTUS = '0xdef171fe48cf0115b1d80b88dc8eab59176fee57'

const CHAINLINK_ETH_USD = '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612'
const CHAINLINK_BTC_USD = '0x6ce185860a4963106506c203335a2910413708e9'

describe('ParaswapV5Connector', () => {
  const SLIPPAGE = 0.01

  before('create paraswap connector', async function () {
    this.connector = await deploy('ParaswapV5Connector', [PARASWAP_V5_AUGUSTUS])
  })

  itBehavesLikeParaswapV5Connector(CHAIN, USDC, WETH, WBTC, WHALE, SLIPPAGE, CHAINLINK_ETH_USD, CHAINLINK_BTC_USD)
})
