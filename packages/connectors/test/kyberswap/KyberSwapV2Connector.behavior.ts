import { deployProxy, fp, impersonate, instanceAt, pct, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { loadOrGetKyberSwapSwapData } from '../helpers/kyberswap'

export function itBehavesLikeKyberSwapV2Connector(
  CHAIN: number,
  USDC: string,
  WETH: string,
  WHALE: string,
  SLIPPAGE: number,
  CHAINLINK_ETH_USD: string
): void {
  let weth: Contract, usdc: Contract, whale: SignerWithAddress, priceOracle: Contract

  before('load tokens and accounts', async function () {
    weth = await instanceAt('IERC20Metadata', WETH)
    usdc = await instanceAt('IERC20Metadata', USDC)
    whale = await impersonate(WHALE, fp(100))
  })

  before('create price oracle', async function () {
    priceOracle = await deployProxy(
      '@mimic-fi/v3-price-oracle/artifacts/contracts/PriceOracle.sol/PriceOracle',
      [],
      [ZERO_ADDRESS, ZERO_ADDRESS, USDC, [{ base: WETH, quote: USDC, feed: CHAINLINK_ETH_USD }]]
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
    const amountIn = toUSDC(10e4)

    it('swaps correctly USDC-WETH', async function () {
      const previousBalance = await weth.balanceOf(this.connector.address)
      await usdc.connect(whale).transfer(this.connector.address, amountIn)

      const data = await loadOrGetKyberSwapSwapData(CHAIN, this.connector, usdc, weth, amountIn, SLIPPAGE)
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

      const data = await loadOrGetKyberSwapSwapData(CHAIN, this.connector, weth, usdc, amountIn, SLIPPAGE)
      await this.connector.connect(whale).execute(WETH, USDC, amountIn, 0, data)

      const currentBalance = await usdc.balanceOf(this.connector.address)
      const expectedMinAmountOut = await getExpectedMinAmountOut(WETH, USDC, amountIn, SLIPPAGE)
      expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
    })
  })
}
