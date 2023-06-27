import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeHopERC20Connector } from './HopL2ERC20Connector.behavior'
import { itBehavesLikeHopNativeConnector } from './HopL2NativeConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
const WHALE = '0xfffbcd322ceace527c8ec6da8de2461c6d9d4e6e'

describe('HopConnector', () => {
  const SOURCE_CHAIN_ID = 137

  before('create hop connector', async function () {
    this.connector = await deploy('HopConnector', [WMATIC])
  })

  context('USDC', () => {
    const HOP_USDC_AMM = '0x76b22b8C1079A44F1211D867D68b1eda76a635A7'

    itBehavesLikeHopERC20Connector(SOURCE_CHAIN_ID, USDC, HOP_USDC_AMM, WHALE)
  })

  context('WMATIC', () => {
    const HOP_MATIC_AMM = '0x884d1Aa15F9957E1aEAA86a82a72e49Bc2bfCbe3'
    const ignoreChains = [10, 42161] // optimism & arbitrum

    itBehavesLikeHopNativeConnector(SOURCE_CHAIN_ID, WMATIC, HOP_MATIC_AMM, WHALE, ignoreChains)
  })
})
