import { deploy, toUSDC } from '@mimic-fi/v3-helpers'

import { itBehavesLikeConnextConnector } from './ConnextConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
const WHALE = '0x8894e0a0c962cb723c1976a4421c95949be2d4e3'

const CONNEXT = '0xCd401c10afa37d641d2F594852DA94C700e4F2CE'

describe('ConnextConnector', () => {
  const SOURCE_CHAIN_ID = 56

  before('create connext connector', async function () {
    this.connector = await deploy('ConnextConnector', [CONNEXT])
  })

  context('USDC', () => {
    itBehavesLikeConnextConnector(SOURCE_CHAIN_ID, USDC, toUSDC(300), CONNEXT, WHALE)
  })
})
