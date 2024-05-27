import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeKyberSwapV2Connector } from './KyberSwapV2Connector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 1

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

const KYBER_SWAP_ROUTER = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'

const CHAINLINK_ETH_USD = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'

describe.skip('KyberSwapV2Connector', () => {
  const SLIPPAGE = 0.02

  before('create KyberSwap connector', async function () {
    this.connector = await deploy('KyberSwapV2Connector', [KYBER_SWAP_ROUTER])
  })

  itBehavesLikeKyberSwapV2Connector(CHAIN, USDC, WETH, WHALE, SLIPPAGE, CHAINLINK_ETH_USD)
})
