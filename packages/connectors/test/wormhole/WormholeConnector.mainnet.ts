import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeWormholeConnector } from './WormholeConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

const WORMHOLE_CIRCLE_RELAYER = '0x32DeC3F4A0723Ce02232f87e8772024E0C86d834'

describe('WormholeConnector', () => {
  const SOURCE_CHAIN_ID = 1

  before('create wormhole connector', async function () {
    this.connector = await deploy('WormholeConnector', [WORMHOLE_CIRCLE_RELAYER])
  })

  context('USDC', () => {
    itBehavesLikeWormholeConnector(SOURCE_CHAIN_ID, USDC, WHALE)
  })
})
