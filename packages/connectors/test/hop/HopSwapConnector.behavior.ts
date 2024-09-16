import { fp, impersonate, instanceAt, toUSDC } from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

export function itBehavesLikeHopSwapConnector(
  CHAIN: number,
  USDC: string,
  HUSDC: string,
  HOP_USDC_DEX: string,
  WHALE: string,
  SLIPPAGE: number
): void {
  let usdc: Contract, husdc: Contract, whale: SignerWithAddress

  before('load tokens and accounts', async function () {
    usdc = await instanceAt('IERC20Metadata', USDC)
    husdc = await instanceAt('IERC20Metadata', HUSDC)
    whale = await impersonate(WHALE, fp(100))
  })

  context('USDC-hUSDC', () => {
    const amountIn = toUSDC(10e3)

    it('swaps correctly', async function () {
      const previousBalance = await husdc.balanceOf(this.connector.address)
      await usdc.connect(whale).transfer(this.connector.address, amountIn)

      await this.connector.connect(whale).execute(USDC, HUSDC, amountIn, 0, HOP_USDC_DEX)

      const currentBalance = await husdc.balanceOf(this.connector.address)
      const expectedMinAmountOut = amountIn.sub(amountIn.mul(fp(SLIPPAGE)).div(fp(1)))
      expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
    })
  })

  context('hUSDC-USDC', () => {
    let amountIn: BigNumber

    beforeEach('load amount in', async function () {
      amountIn = await husdc.balanceOf(this.connector.address)
      expect(amountIn).to.be.gt(0)
    })

    it('swaps correctly hUSDC-USDC', async function () {
      const previousBalance = await usdc.balanceOf(this.connector.address)

      await this.connector.connect(whale).execute(HUSDC, USDC, amountIn, 0, HOP_USDC_DEX)

      const currentBalance = await usdc.balanceOf(this.connector.address)
      const expectedMinAmountOut = amountIn.sub(amountIn.mul(fp(SLIPPAGE)).div(fp(1)))
      expect(currentBalance.sub(previousBalance)).to.be.at.least(expectedMinAmountOut)
    })
  })
}
