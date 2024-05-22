import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeHopERC20Connector } from './HopL2ERC20Connector.behavior'
import { itBehavesLikeHopNativeConnector } from './HopL2NativeConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDT = '0x4ECaBa5870353805a9F068101A40E0f32ed605C6'
const WXDAI = '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'

describe('HopBridgeConnector', () => {
  const SOURCE_CHAIN_ID = 100

  before('create hop connector', async function () {
    this.connector = await deploy('HopBridgeConnector', [WXDAI])
  })

  context('USDT', () => {
    const WHALE = '0xba12222222228d8ba445958a75a0704d566bf2c8'
    const HOP_USDT_AMM = '0x49094a1B3463c4e2E82ca41b8e6A023bdd6E222f'

    itBehavesLikeHopERC20Connector(SOURCE_CHAIN_ID, USDT, HOP_USDT_AMM, WHALE)
  })

  context('xDAI', () => {
    const WHALE = '0xd4e420bbf00b0f409188b338c5d87df761d6c894'
    const HOP_DAI_AMM = '0x6C928f435d1F3329bABb42d69CCF043e3900EcF1'

    itBehavesLikeHopNativeConnector(SOURCE_CHAIN_ID, WXDAI, HOP_DAI_AMM, WHALE)
  })
})
