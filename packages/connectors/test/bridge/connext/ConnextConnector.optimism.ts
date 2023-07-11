import { deploy, fp, toUSDC } from '@mimic-fi/v3-helpers'

import { itBehavesLikeConnextConnector } from './ConnextConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
const WETH = '0x4200000000000000000000000000000000000006'
const WHALE = '0x85149247691df622eaf1a8bd0cafd40bc45154a9'

const CONNEXT = '0x8f7492DE823025b4CfaAB1D34c58963F2af5DEDA'

describe('ConnextConnector', () => {
  const SOURCE_CHAIN_ID = 10

  before('create connext connector', async function () {
    this.connector = await deploy('ConnextConnector', [CONNEXT])
  })

  context('USDC', () => {
    itBehavesLikeConnextConnector(SOURCE_CHAIN_ID, USDC, toUSDC(300), CONNEXT, WHALE)
  })

  context('WETH', () => {
    itBehavesLikeConnextConnector(SOURCE_CHAIN_ID, WETH, fp(2), CONNEXT, WHALE)
  })
})
