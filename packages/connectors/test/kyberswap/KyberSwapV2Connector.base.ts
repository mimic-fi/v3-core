import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeKyberSwapV2Connector } from './KyberSwapV2Connector.behavior'

/* eslint-disable no-secrets/no-secrets */
const CHAIN = 8453

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const WETH = '0x4200000000000000000000000000000000000006'
const WHALE = '0xec8d8D4b215727f3476FF0ab41c406FA99b4272C'

const KYBER_SWAP_ROUTER = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'

const CHAINLINK_ETH_USD = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'

describe('KyberSwapV2Connector', () => {
  const SLIPPAGE = 0.02

  before('create KyberSwap connector', async function () {
    this.connector = await deploy('KyberSwapV2Connector', [KYBER_SWAP_ROUTER])
  })

  itBehavesLikeKyberSwapV2Connector(CHAIN, USDC, WETH, WHALE, SLIPPAGE, CHAINLINK_ETH_USD)
})
