import { deploy } from '@mimic-fi/helpers'

import { itBehavesLikeOdosV2Connector } from './OdosV2Connector.behavior'

/* eslint-disable no-secrets/no-secrets */
const CHAIN = 8453

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const WETH = '0x4200000000000000000000000000000000000006'
const WHALE = '0xec8d8D4b215727f3476FF0ab41c406FA99b4272C'

const ODOS_ROUTER = '0x19cEeAd7105607Cd444F5ad10dd51356436095a1'

const CHAINLINK_ETH_USD = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'

describe('OdosV2Connector', () => {
  const SLIPPAGE = 0.02

  before('create Odos connector', async function () {
    this.connector = await deploy('OdosV2Connector', [ODOS_ROUTER])
  })

  itBehavesLikeOdosV2Connector(CHAIN, USDC, WETH, WHALE, SLIPPAGE, CHAINLINK_ETH_USD)
})
