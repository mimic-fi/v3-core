import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeUniswapV3Connector } from './UniswapV3Connector.behavior'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
const WBTC = '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'
const WHALE = '0x21cb017b40abe17b6dfb9ba64a3ab0f24a7e60ea'

const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

const CHAINLINK_USDC_ETH = '0xefb7e6be8356ccc6827799b6a7348ee674a80eae'
const CHAINLINK_WBTC_ETH = '0x19b0F0833C78c0848109E3842D34d2fDF2cA69BA'

describe('UniswapV3Connector', () => {
  const SLIPPAGE = 0.02
  const WETH_USDC_FEE = 3000
  const WETH_WBTC_FEE = 3000

  before('create uniswap v3 connector', async function () {
    this.connector = await deploy('UniswapV3Connector', [UNISWAP_V3_ROUTER])
  })

  itBehavesLikeUniswapV3Connector(
    USDC,
    WETH,
    WBTC,
    WHALE,
    SLIPPAGE,
    WETH_USDC_FEE,
    WETH_WBTC_FEE,
    CHAINLINK_USDC_ETH,
    CHAINLINK_WBTC_ETH
  )
})
