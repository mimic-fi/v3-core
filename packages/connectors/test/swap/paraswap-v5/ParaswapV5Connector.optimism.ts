import { deploy } from '@mimic-fi/v3-helpers'

import { itBehavesLikeParaswapV5Connector } from './ParaswapV5Connector.behavior'

/* eslint-disable no-secrets/no-secrets */

const CHAIN = 10

const USDC = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
const WETH = '0x4200000000000000000000000000000000000006'
const WBTC = '0x68f180fcce6836688e9084f035309e29bf0a2095'
const WHALE = '0x1ee95bbd8d25ab561da17c464520af14a8943314'

const PARASWAP_V5_AUGUSTUS = '0xdef171fe48cf0115b1d80b88dc8eab59176fee57'

const CHAINLINK_ETH_USD = '0x13e3ee699d1909e989722e753853ae30b17e08c5'
const CHAINLINK_BTC_USD = '0xd702dd976fb76fffc2d3963d037dfdae5b04e593'

describe('ParaswapV5Connector', () => {
  const SLIPPAGE = 0.01

  before('create paraswap connector', async function () {
    this.connector = await deploy('ParaswapV5Connector', [PARASWAP_V5_AUGUSTUS])
  })

  itBehavesLikeParaswapV5Connector(CHAIN, USDC, WETH, WBTC, WHALE, SLIPPAGE, CHAINLINK_ETH_USD, CHAINLINK_BTC_USD)
})
