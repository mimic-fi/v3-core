import { deploy } from '@mimic-fi/helpers'

import { itBehavesLikeUniswapV2Connector } from './UniswapV2Connector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
const WBTC = '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'
const WHALE = '0x21cb017b40abe17b6dfb9ba64a3ab0f24a7e60ea'

const UNISWAP_V2_ROUTER = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' // QuickSwap

const CHAINLINK_USDC_ETH = '0xefb7e6be8356ccc6827799b6a7348ee674a80eae'
const CHAINLINK_WBTC_ETH = '0x19b0F0833C78c0848109E3842D34d2fDF2cA69BA'

describe('UniswapV2Connector', () => {
  const SLIPPAGE = 0.05

  before('create Uniswap V3 swap connector', async function () {
    this.connector = await deploy('UniswapV2Connector', [UNISWAP_V2_ROUTER])
  })

  itBehavesLikeUniswapV2Connector(USDC, WETH, WBTC, WHALE, SLIPPAGE, CHAINLINK_USDC_ETH, CHAINLINK_WBTC_ETH)
})
