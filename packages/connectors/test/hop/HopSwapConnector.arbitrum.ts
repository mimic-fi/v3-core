import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeHopSwapConnector } from './HopSwapConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 42161

const USDCe = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
const HUSDC = '0x0ce6c85cf43553de10fc56ceca0aef6ff0dd444d'
const WHALE = '0x5bdf85216ec1e38d6458c870992a69e38e03f7ef'
const HOP_USDC_DEX = '0x10541b07d8ad2647dc6cd67abd4c03575dade261'

describe('HopSwapConnector', () => {
  const SLIPPAGE = 0.015

  before('create hop swap connector', async function () {
    this.connector = await deploy('HopSwapConnector')
  })

  itBehavesLikeHopSwapConnector(CHAIN, USDCe, HUSDC, HOP_USDC_DEX, WHALE, SLIPPAGE)
})
