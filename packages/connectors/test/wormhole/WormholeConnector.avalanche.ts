import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeWormholeConnector } from './WormholeConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
const WHALE = '0xbbff2a8ec8d702e61faaccf7cf705968bb6a5bab'

const WORMHOLE_CIRCLE_RELAYER = '0x32DeC3F4A0723Ce02232f87e8772024E0C86d834'

describe('WormholeConnector', () => {
  const SOURCE_CHAIN_ID = 43114

  before('create bridge connector', async function () {
    this.connector = await deploy('WormholeConnector', [WORMHOLE_CIRCLE_RELAYER])
  })

  context('USDC', () => {
    itBehavesLikeWormholeConnector(SOURCE_CHAIN_ID, USDC, WHALE)
  })
})
