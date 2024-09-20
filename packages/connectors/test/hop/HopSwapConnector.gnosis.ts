import { deploy } from '@mimic-fi/helpers'

import { itBehavesLikeHopSwapConnector } from './HopSwapConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 100

const USDC = '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83'
const HUSDC = '0x9ec9551d4a1a1593b0ee8124d98590cc71b3b09d'
const WHALE = '0xc66825c5c04b3c2ccd536d626934e16248a63f68'
const HOP_USDC_SWAP = '0x5c32143c8b198f392d01f8446b754c181224ac26'

describe('HopSwapConnector', () => {
  const SLIPPAGE = 0.02

  before('create hop swap connector', async function () {
    this.connector = await deploy('HopSwapConnector')
  })

  itBehavesLikeHopSwapConnector(CHAIN, USDC, HUSDC, HOP_USDC_SWAP, WHALE, SLIPPAGE)
})
