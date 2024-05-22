import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeKyberSwapV2Connector } from './KyberSwapV2Connector.behavior'

/* eslint-disable no-secrets/no-secrets */
const CHAIN = 137

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
const WBTC = '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'
const WHALE = '0xf25212e676d1f7f89cd72ffee66158f541246445'

const KYBER_SWAP_ROUTER = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'

const CHAINLINK_USDC_ETH = '0xefb7e6be8356ccc6827799b6a7348ee674a80eae'
const CHAINLINK_WBTC_ETH = '0x19b0F0833C78c0848109E3842D34d2fDF2cA69BA'

describe('KyberSwapV2Connector', () => {
  const SLIPPAGE = 0.015

  before('create KyberSwap connector', async function () {
    this.connector = await deploy('KyberSwapV2Connector', [KYBER_SWAP_ROUTER])
  })

  itBehavesLikeKyberSwapV2Connector(CHAIN, USDC, WETH, WBTC, WHALE, SLIPPAGE, CHAINLINK_USDC_ETH, CHAINLINK_WBTC_ETH)
})
