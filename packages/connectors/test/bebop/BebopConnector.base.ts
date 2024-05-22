import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeBebopConnector } from './BebopConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 8453

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const WETH = '0x4200000000000000000000000000000000000006'
const WHALE = '0xec8d8D4b215727f3476FF0ab41c406FA99b4272C'

const BEBOP_SETTLEMENT = '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F'

const CHAINLINK_ETH_USD = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'

describe('BebopConnector', () => {
  const SLIPPAGE = 0.015

  before('create bebop connector', async function () {
    this.connector = await deploy('BebopConnector', [BEBOP_SETTLEMENT])
  })

  itBehavesLikeBebopConnector(CHAIN, USDC, WETH, WHALE, SLIPPAGE, CHAINLINK_ETH_USD)
})
