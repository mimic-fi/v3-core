import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeAxelarConnector } from './AxelarConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const ARB = '0x912CE59144191C1204E64559FE8253a0e49E6548'
const WHALE = '0xf977814e90da44bfa03b6295a0616a897441acec'

const AXELAR_GATEWAY = '0xe432150cce91c13a887f7D836923d5597adD8E31'

describe('AxelarConnector', () => {
  const SOURCE_CHAIN_ID = 42161

  before('create axelar connector', async function () {
    this.connector = await deploy('AxelarConnector', [AXELAR_GATEWAY])
  })
  
  context('ARB', () => {
    itBehavesLikeAxelarConnector(SOURCE_CHAIN_ID, ARB, AXELAR_GATEWAY, WHALE)
  })
})
