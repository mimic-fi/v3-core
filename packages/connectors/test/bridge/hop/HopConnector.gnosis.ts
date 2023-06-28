import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeHopERC20Connector } from './HopL2ERC20Connector.behavior'
import { itBehavesLikeHopNativeConnector } from './HopL2NativeConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83'
const WXDAI = '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'

describe('HopConnector', () => {
  const SOURCE_CHAIN_ID = 100

  before('create hop connector', async function () {
    this.connector = await deploy('HopConnector', [WXDAI])
  })

  context('USDC', () => {
    const WHALE = '0xc66825c5c04b3c2ccd536d626934e16248a63f68'
    const HOP_USDC_AMM = '0x76b22b8C1079A44F1211D867D68b1eda76a635A7'

    itBehavesLikeHopERC20Connector(SOURCE_CHAIN_ID, USDC, HOP_USDC_AMM, WHALE)
  })

  context('xDAI', () => {
    const WHALE = '0xd4e420bbf00b0f409188b338c5d87df761d6c894'
    const HOP_DAI_AMM = '0x6C928f435d1F3329bABb42d69CCF043e3900EcF1'

    itBehavesLikeHopNativeConnector(SOURCE_CHAIN_ID, WXDAI, HOP_DAI_AMM, WHALE)
  })
})
