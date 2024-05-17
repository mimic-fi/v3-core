import { fp, impersonate, instanceAt, pct, toUSDC, toWBTC } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

export function itBehavesLikeBalancerV2SwapConnector(
  USDC: string,
  WETH: string,
  WBTC: string,
  WHALE: string,
  SLIPPAGE: number,
  WETH_USDC_POOL_ID: string,
  WETH_WBTC_POOL_ID: string
): void {
  let weth: Contract, usdc: Contract, wbtc: Contract, whale: SignerWithAddress

  before('load tokens and accounts', async function () {
    weth = await instanceAt('IERC20Metadata', WETH)
    wbtc = await instanceAt('IERC20Metadata', WBTC)
    usdc = await instanceAt('IERC20Metadata', USDC)
    whale = await impersonate(WHALE, fp(100))
  })

  const getExpectedMinAmountOut = async (
    priceOracle: Contract,
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    slippage: number
  ): Promise<BigNumber> => {
    const price = await priceOracle['getPrice(address,address)'](tokenIn, tokenOut)
    const expectedAmountOut = price.mul(amountIn).div(fp(1))
    return expectedAmountOut.sub(pct(expectedAmountOut, slippage))
  }

  context('single swap', () => {
    const hopPoolIds = []
    const hopTokens = []

    context('USDC-WETH', () => {
      const amountIn = toUSDC(100)

      it('swaps correctly', async function () {
        const previousBalance = await weth.balanceOf(this.connector.address)
        await usdc.connect(whale).transfer(this.connector.address, amountIn)

        const minAmountOut = await getExpectedMinAmountOut(this.priceOracle, USDC, WETH, amountIn, SLIPPAGE)
        await this.connector
          .connect(whale)
          .execute(USDC, WETH, amountIn, minAmountOut, WETH_USDC_POOL_ID, hopPoolIds, hopTokens)

        const currentBalance = await weth.balanceOf(this.connector.address)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(minAmountOut)
      })
    })

    context('WETH-USDC', async function () {
      const amountIn = fp(1)

      it('swaps correctly', async function () {
        const previousBalance = await usdc.balanceOf(this.connector.address)
        await weth.connect(whale).transfer(this.connector.address, amountIn)

        const minAmountOut = await getExpectedMinAmountOut(this.priceOracle, WETH, USDC, amountIn, SLIPPAGE)
        await this.connector
          .connect(whale)
          .execute(WETH, USDC, amountIn, minAmountOut, WETH_USDC_POOL_ID, hopPoolIds, hopTokens)

        const currentBalance = await usdc.balanceOf(this.connector.address)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(minAmountOut)
      })
    })
  })

  context('batch swap', () => {
    const hopTokens = [WETH]

    context('USDC-WBTC', () => {
      const amountIn = toUSDC(100)
      const hopPoolIds = [WETH_WBTC_POOL_ID]

      it('swaps correctly', async function () {
        const previousBalance = await wbtc.balanceOf(this.connector.address)
        await usdc.connect(whale).transfer(this.connector.address, amountIn)

        const minAmountOut = await getExpectedMinAmountOut(this.priceOracle, USDC, WBTC, amountIn, SLIPPAGE)
        await this.connector
          .connect(whale)
          .execute(USDC, WBTC, amountIn, minAmountOut, WETH_USDC_POOL_ID, hopPoolIds, hopTokens)

        const currentBalance = await wbtc.balanceOf(this.connector.address)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(minAmountOut)
      })
    })

    context('WBTC-USDC', () => {
      const amountIn = toWBTC(0.1)
      const hopPoolIds = [WETH_USDC_POOL_ID]

      it('swaps correctly', async function () {
        const previousBalance = await usdc.balanceOf(this.connector.address)
        await wbtc.connect(whale).transfer(this.connector.address, amountIn)

        const minAmountOut = await getExpectedMinAmountOut(this.priceOracle, WBTC, USDC, amountIn, SLIPPAGE)
        await this.connector
          .connect(whale)
          .execute(WBTC, USDC, amountIn, minAmountOut, WETH_WBTC_POOL_ID, hopPoolIds, hopTokens)

        const currentBalance = await usdc.balanceOf(this.connector.address)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(minAmountOut)
      })
    })
  })
}
