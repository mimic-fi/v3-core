import { assertAlmostEqual, deployProxy, fp, getSigner } from '@mimic-fi/v3-helpers'
import { BigNumber, Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const USD = '0x0000000000000000000000000000000000000348' // address(840)
const DAI = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'
const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const WETH = '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'
const WBTC = '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'

const CHAINLINK_ORACLE_DAI_USD = '0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D'
const CHAINLINK_ORACLE_USDC_USD = '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7'
const CHAINLINK_ORACLE_WETH_USD = '0xF9680D99D6C9589e2a93a78A04A279e509205945'
const CHAINLINK_ORACLE_WBTC_USD = '0xc907E116054Ad103354f2D350FD2514433D57F6f'

describe('PriceOracle', () => {
  let priceOracle: Contract

  const ERROR = 0.01
  const ETH_USD = 1518
  const BTC_USD = 20720
  const ETH_BTC = ETH_USD / BTC_USD

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
        USD,
        [
          { base: DAI, quote: USD, feed: CHAINLINK_ORACLE_DAI_USD },
          { base: USDC, quote: USD, feed: CHAINLINK_ORACLE_USDC_USD },
          { base: WETH, quote: USD, feed: CHAINLINK_ORACLE_WETH_USD },
          { base: WBTC, quote: USD, feed: CHAINLINK_ORACLE_WBTC_USD },
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
