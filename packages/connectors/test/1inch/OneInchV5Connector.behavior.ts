import { deployProxy, fp, impersonate, instanceAt, pct, toUSDC, toWBTC, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { loadOrGet1inchSwapData } from '../helpers/1inch-v5'

export function itBehavesLikeOneInchV5Connector(
  CHAIN: number,
  USDC: string,
  WETH: string,
  WBTC: string,
  WHALE: string,
  SLIPPAGE: number,
  CHAINLINK_USDC_ETH: string,
  CHAINLINK_WBTC_ETH: string
): void {
  let weth: Contract, usdc: Contract, wbtc: Contract, whale: SignerWithAddress, priceOracle: Contract

  before('load tokens and accounts', async function () {
    weth = await instanceAt('IERC20Metadata', WETH)
    wbtc = await instanceAt('IERC20Metadata', WBTC)
    usdc = await instanceAt('IERC20Metadata', USDC)
    whale = await impersonate(WHALE, fp(100))
  })

  before('create price oracle', async function () {
    priceOracle = await deployProxy(
      '@mimic-fi/v3-price-oracle/artifacts/contracts/PriceOracle.sol/PriceOracle',
      [],
      [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        WETH,
        [
          { base: USDC, quote: WETH, feed: CHAINLINK_USDC_ETH },
          { base: WBTC, quote: WETH, feed: CHAINLINK_WBTC_ETH },
        ],
      ]
    )
  })

  const getExpectedMinAmountOut = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    slippage: number
  ): Promise<BigNumber> => {
    const price = await priceOracle['getPrice(address,address)'](tokenIn, tokenOut)
    const expectedAmountOut = price.mul(amountIn).div(fp(1))
    return expectedAmountOut.sub(pct(expectedAmountOut, slippage))
  }

  context('USDC-WETH', () => {
    const amountIn = toUSDC(10e3)

    it('swaps correctly USDC-WETH', async function () {
      const previousBalance = await weth.balanceOf(this.connector.address)
      await usdc.connect(whale).transfer(this.connector.address, amountIn)

      const data = await loadOrGet1inchSwapData(CHAIN, this.connector, usdc, weth, amountIn, SLIPPAGE)
      await this.connector.connect(whale).execute(USDC, WETH, amountIn, 0, data)

      const currentBalance = await weth.balanceOf(this.connector.address)
      const expectedMinAmountOut = await getExpectedMinAmountOut(USDC, WETH, amountIn, SLIPPAGE)
      expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
    })
  })

  context('WETH-USDC', () => {
    const amountIn = fp(1)

    it('swaps correctly WETH-USDC', async function () {
      const previousBalance = await usdc.balanceOf(this.connector.address)
      await weth.connect(whale).transfer(this.connector.address, amountIn)

      const data = await loadOrGet1inchSwapData(CHAIN, this.connector, weth, usdc, amountIn, SLIPPAGE)
      await this.connector.connect(whale).execute(WETH, USDC, amountIn, 0, data)

      const currentBalance = await usdc.balanceOf(this.connector.address)
      const expectedMinAmountOut = await getExpectedMinAmountOut(WETH, USDC, amountIn, SLIPPAGE)
      expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
    })
  })

  if (WBTC !== ZERO_ADDRESS) {
    context('WBTC-USDC', () => {
      const amountIn = toWBTC(1)

      it('swaps correctly WTBC-USDC', async function () {
        const previousBalance = await usdc.balanceOf(this.connector.address)
        await wbtc.connect(whale).transfer(this.connector.address, amountIn)

        const data = await loadOrGet1inchSwapData(CHAIN, this.connector, wbtc, usdc, amountIn, SLIPPAGE)
        await this.connector.connect(whale).execute(WBTC, USDC, amountIn, 0, data)

        const currentBalance = await usdc.balanceOf(this.connector.address)
        const expectedMinAmountOut = await getExpectedMinAmountOut(WBTC, USDC, amountIn, SLIPPAGE)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
      })
    })
  }
}
