import { assertAlmostEqual, deployProxy, fp, getSigner } from '@mimic-fi/helpers'
import { BigNumber, Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'

const CHAINLINK_ORACLE_DAI_ETH = '0x773616E4d11A78F511299002da57A0a94577F1f4'
const CHAINLINK_ORACLE_USDC_ETH = '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'
const CHAINLINK_ORACLE_WBTC_ETH = '0xdeb288F737066589598e9214E782fa5A8eD689e8'

describe('PriceOracle', () => {
  let priceOracle: Contract

  const ERROR = 0.01
  const ETH_USD = 1610
  const ETH_BTC = 0.0754
  const BTC_USD = ETH_USD / ETH_BTC

  const getPrice = async (base: string, quote: string): Promise<BigNumber> => {
    return priceOracle['getPrice(address,address)'](base, quote)
  }

  before('create price oracle', async () => {
    const owner = await getSigner()
    const authorizer = await deployProxy(
      '@mimic-fi/v3-authorizer/artifacts/contracts/Authorizer.sol/Authorizer',
      [],
      [[owner.address]]
    )

    priceOracle = await deployProxy(
      'PriceOracle',
      [],
      [
        authorizer.address,
        owner.address,
        WETH,
        [
          { base: DAI, quote: WETH, feed: CHAINLINK_ORACLE_DAI_ETH },
          { base: USDC, quote: WETH, feed: CHAINLINK_ORACLE_USDC_ETH },
          { base: WBTC, quote: WETH, feed: CHAINLINK_ORACLE_WBTC_ETH },
        ],
      ]
    )
  })

  context('WETH - DAI', () => {
    it('quotes WETH/DAI correctly', async () => {
      const expectedPrice = fp(ETH_USD)
      const price = await getPrice(WETH, DAI)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })

    it('quotes DAI/WETH correctly', async () => {
      const expectedPrice = fp(1 / ETH_USD)
      const price = await getPrice(DAI, WETH)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })
  })

  context('WETH - USDC', () => {
    it('quotes WETH/USDC correctly', async () => {
      const expectedPrice = fp(ETH_USD).div(1e12) // 6 decimals => WETH * price / 1e18 = USDC
      const price = await getPrice(WETH, USDC)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })

    it('quotes USDC/WETH correctly', async () => {
      const expectedPrice = fp(1 / ETH_USD).mul(1e12) // 30 decimals => USDC * price / 1e18 = WETH
      const price = await getPrice(USDC, WETH)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })
  })

  context('WETH - WBTC', () => {
    it('quotes WETH/WBTC correctly', async () => {
      const expectedPrice = fp(ETH_BTC).div(1e10) // 8 decimals => WETH * price / 1e18 = WBTC
      const price = await getPrice(WETH, WBTC)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })

    it('quotes WBTC/WETH correctly', async () => {
      const expectedPrice = fp(1 / ETH_BTC).mul(1e10) // 28 decimals => WBTC * price / 1e18 = WETH
      const price = await getPrice(WBTC, WETH)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })
  })

  context('WBTC - USDC', () => {
    it('quotes WBTC/USDC correctly', async () => {
      const expectedPrice = fp(BTC_USD).div(1e2) // 16 decimals => WBTC * price / 1e18 = USDC
      const price = await getPrice(WBTC, USDC)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })

    it('quotes USDC/WBTC correctly', async () => {
      const expectedPrice = fp(1 / BTC_USD).mul(1e2) // 20 decimals => USDC * price / 1e18 = WBTC
      const price = await getPrice(USDC, WBTC)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })
  })

  context('WBTC - DAI', () => {
    it('quotes WBTC/DAI correctly', async () => {
      const expectedPrice = fp(BTC_USD).mul(1e10) // 28 decimals => WBTC * price / 1e18 = DAI
      const price = await getPrice(WBTC, DAI)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })

    it('quotes DAI/WBTC correctly', async () => {
      const expectedPrice = fp(1 / BTC_USD).div(1e10) // 8 decimals => DAI * price / 1e18 = WBTC
      const price = await getPrice(DAI, WBTC)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })
  })

  context('DAI - USDC', () => {
    it('quotes DAI/USDC correctly', async () => {
      const expectedPrice = fp(1).div(1e12) // 6 decimals => DAI * price / 1e18 = USDC
      const price = await getPrice(DAI, USDC)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })

    it('quotes USDC/DAI correctly', async () => {
      const expectedPrice = fp(1).mul(1e12) // 30 decimals => USDC * price / 1e18 = DAI
      const price = await getPrice(USDC, DAI)
      assertAlmostEqual(price, expectedPrice, ERROR)
    })
  })
})
