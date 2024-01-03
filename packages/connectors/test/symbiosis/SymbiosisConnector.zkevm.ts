import { deploy, fp, toUSDC } from '@mimic-fi/v3-helpers'

import {
  itBehavesLikeSymbiosisConnectorBridgingUSDC,
  itBehavesLikeSymbiosisConnectorBridgingWETH,
} from './SymbiosisConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035'
const WETH = '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9'
const WHALE = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'

const SYMBIOSIS_META_ROUTER = '0xDF41Ce9d15e9b6773ef20cA682AFE56af6Bb3F94'

describe('SymbiosisConnector', () => {
  const SOURCE_CHAIN_ID = 1101
  const SLIPPAGE = 0.03

  before('create symbiosis connector', async function () {
    this.connector = await deploy('SymbiosisConnector', [SYMBIOSIS_META_ROUTER])
  })

  context('USDC', () => {
    itBehavesLikeSymbiosisConnectorBridgingUSDC(SOURCE_CHAIN_ID, USDC, toUSDC(150), WHALE, SLIPPAGE)
  })

  context('WETH', () => {
    itBehavesLikeSymbiosisConnectorBridgingWETH(SOURCE_CHAIN_ID, WETH, fp(2.5), WHALE, SLIPPAGE)
  })
})
