import { deployProxy, fp, impersonate, instanceAt, pct, toUSDC, toWBTC, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { loadOrGetParaswapSwapData } from '../helpers/paraswap-v5'

export function itBehavesLikeParaswapV5Connector(
  CHAIN: number,
  USDC: string,
  WETH: string,
  WBTC: string,
  WHALE: string,
  SLIPPAGE: number,
  CHAINLINK_ETH_USD: string,
  CHAINLINK_BTC_USD: string
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
        USDC,
        [
          { base: WETH, quote: USDC, feed: CHAINLINK_ETH_USD },
          { base: WBTC, quote: USDC, feed: CHAINLINK_BTC_USD },
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

    it('swaps correctly', async function () {
      const { minAmountOut, data } = await loadOrGetParaswapSwapData(
        CHAIN,
        this.connector,
        usdc,
        weth,
        amountIn,
        SLIPPAGE
      )

      await usdc.connect(whale).transfer(this.connector.address, amountIn)
      await this.connector.connect(whale).execute(USDC, WETH, amountIn, minAmountOut, data)

      const swappedBalance = await weth.balanceOf(this.connector.address)
      const expectedMinAmountOut = await getExpectedMinAmountOut(USDC, WETH, amountIn, SLIPPAGE)
      expect(swappedBalance).to.be.at.least(expectedMinAmountOut)
    })
  })

  context('WETH-USDC', () => {
    const amountIn = fp(1)

    it('swaps correctly', async function () {
      const { minAmountOut, data } = await loadOrGetParaswapSwapData(
        CHAIN,
        this.connector,
        weth,
        usdc,
        amountIn,
        SLIPPAGE
      )

      await weth.connect(whale).transfer(this.connector.address, amountIn)
      await this.connector.connect(whale).execute(WETH, USDC, amountIn, minAmountOut, data)

      const swappedBalance = await usdc.balanceOf(this.connector.address)
      const expectedMinAmountOut = await getExpectedMinAmountOut(WETH, USDC, amountIn, SLIPPAGE)
      expect(swappedBalance).to.be.at.least(expectedMinAmountOut)
    })
  })

  context('WBTC-USDC', () => {
    const amountIn = toWBTC(1)

    it('swaps correctly', async function () {
      const { minAmountOut, data } = await loadOrGetParaswapSwapData(
        CHAIN,
        this.connector,
        wbtc,
        usdc,
        amountIn,
        SLIPPAGE
      )

      await wbtc.connect(whale).transfer(this.connector.address, amountIn)
      await this.connector.connect(whale).execute(WBTC, USDC, amountIn, minAmountOut, data)

      const swappedBalance = await usdc.balanceOf(this.connector.address)
      const expectedMinAmountOut = await getExpectedMinAmountOut(WBTC, USDC, amountIn, SLIPPAGE)
      expect(swappedBalance).to.be.at.least(expectedMinAmountOut)
    })
  })
}
