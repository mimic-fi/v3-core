import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeOneInchV5Connector } from './OneInchV5Connector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 137

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
const WBTC = '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'
const WHALE = '0x21cb017b40abe17b6dfb9ba64a3ab0f24a7e60ea'

const ONE_INCH_V5_ROUTER = '0x1111111254EEB25477B68fb85Ed929f73A960582'

const CHAINLINK_USDC_ETH = '0xefb7e6be8356ccc6827799b6a7348ee674a80eae'
const CHAINLINK_WBTC_ETH = '0x19b0F0833C78c0848109E3842D34d2fDF2cA69BA'

describe('OneInchV5Connector', () => {
  const SLIPPAGE = 0.01

  before('create 1inch v5 connector', async function () {
    this.connector = await deploy('OneInchV5Connector', [ONE_INCH_V5_ROUTER])
  })

  itBehavesLikeOneInchV5Connector(CHAIN, USDC, WETH, WBTC, WHALE, SLIPPAGE, CHAINLINK_USDC_ETH, CHAINLINK_WBTC_ETH)
})
