import { deploy, fp, toUSDC } from '@mimic-fi/v3-helpers'

import { itBehavesLikeSymbiosisConnector, Token } from './SymbiosisConnector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WHALE = '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621'

const SYMBIOSIS_META_ROUTER = '0xf621Fb08BBE51aF70e7E0F4EA63496894166Ff7F'

describe('SymbiosisConnector', () => {
  const SOURCE_CHAIN_ID = 1
  const SLIPPAGE = 0.03

  before('create symbiosis connector', async function () {
    this.connector = await deploy('SymbiosisConnector', [SYMBIOSIS_META_ROUTER])
  })

  context('USDC', () => {
    itBehavesLikeSymbiosisConnector(SOURCE_CHAIN_ID, USDC, Token.USDC, toUSDC(150), WHALE, SLIPPAGE)
  })

  context('WETH', () => {
    itBehavesLikeSymbiosisConnector(SOURCE_CHAIN_ID, WETH, Token.WETH, fp(2.5), WHALE, SLIPPAGE)
  })
})
