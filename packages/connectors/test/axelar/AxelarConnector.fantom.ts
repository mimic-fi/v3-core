import { deploy } from '@mimic-fi/helpers'

import { itBehavesLikeAxelarConnector } from './AxelarConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const WFTM = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'
const WHALE = '0xe3bd349bdb8203c15426b2d273f57568e658f843'

const AXELAR_GATEWAY = '0x304acf330bbE08d1e512eefaa92F6a57871fD895'

describe('AxelarConnector', () => {
  const SOURCE_CHAIN_ID = 250

  before('create axelar connector', async function () {
    this.connector = await deploy('AxelarConnector', [AXELAR_GATEWAY])
  })

  context('WFTM', () => {
    itBehavesLikeAxelarConnector(SOURCE_CHAIN_ID, WFTM, AXELAR_GATEWAY, WHALE)
  })
})
