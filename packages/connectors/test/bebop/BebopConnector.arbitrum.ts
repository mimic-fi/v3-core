import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeBebopConnector } from './BebopConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 42161

const USDC = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
const WHALE = '0xEeBe760354F5dcBa195EDe0a3B93901441D0968F'

const BEBOP_SETTLEMENT = '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F'

const CHAINLINK_ETH_USD = '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612'

describe('BebopConnector', () => {
  const SLIPPAGE = 0.015

  before('create bebop connector', async function () {
    this.connector = await deploy('BebopConnector', [BEBOP_SETTLEMENT])
  })

  itBehavesLikeBebopConnector(CHAIN, USDC, WETH, WHALE, SLIPPAGE, CHAINLINK_ETH_USD)
})
