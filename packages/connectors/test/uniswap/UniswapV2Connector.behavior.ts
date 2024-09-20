import { deployProxy, fp, impersonate, instanceAt, pct, toUSDC, toWBTC, ZERO_ADDRESS } from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

export function itBehavesLikeUniswapV2Connector(
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

  context('single swap', () => {
    const hopTokens = []

    context('USDC-WETH', () => {
      const amountIn = toUSDC(10e3)

      it('swaps correctly', async function () {
        const previousBalance = await weth.balanceOf(this.connector.address)
        await usdc.connect(whale).transfer(this.connector.address, amountIn)

        await this.connector.connect(whale).execute(USDC, WETH, amountIn, 0, hopTokens)

        const currentBalance = await weth.balanceOf(this.connector.address)
        const expectedMinAmountOut = await getExpectedMinAmountOut(USDC, WETH, amountIn, SLIPPAGE)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
      })
    })

    context('WETH-USDC', () => {
      const amountIn = fp(1)

      it('swaps correctly', async function () {
        const previousBalance = await usdc.balanceOf(this.connector.address)
        await weth.connect(whale).transfer(this.connector.address, amountIn)

        await this.connector.connect(whale).execute(WETH, USDC, amountIn, 0, hopTokens)

        const currentBalance = await usdc.balanceOf(this.connector.address)
        const expectedMinAmountOut = await getExpectedMinAmountOut(WETH, USDC, amountIn, SLIPPAGE)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
      })
    })
  })

  context('batch swap', () => {
    const hopTokens = [WETH]

    context('USDC-WBTC', () => {
      const amountIn = toUSDC(10e3)

      it('swaps correctly', async function () {
        const previousBalance = await wbtc.balanceOf(this.connector.address)
        await usdc.connect(whale).transfer(this.connector.address, amountIn)

        await this.connector.connect(whale).execute(USDC, WBTC, amountIn, 0, hopTokens)

        const currentBalance = await wbtc.balanceOf(this.connector.address)
        const expectedMinAmountOut = await getExpectedMinAmountOut(USDC, WBTC, amountIn, SLIPPAGE)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
      })
    })

    context('WBTC-USDC', () => {
      const amountIn = toWBTC(1)

      it('swaps correctly', async function () {
        const previousBalance = await usdc.balanceOf(this.connector.address)
        await wbtc.connect(whale).transfer(this.connector.address, amountIn)

        await this.connector.connect(whale).execute(WBTC, USDC, amountIn, 0, hopTokens)

        const currentBalance = await usdc.balanceOf(this.connector.address)
        const expectedMinAmountOut = await getExpectedMinAmountOut(WBTC, USDC, amountIn, SLIPPAGE)
        expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
      })
    })
  })
}
