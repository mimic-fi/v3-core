import { fp, impersonate, instanceAt } from '@mimic-fi/helpers'
import { expect } from 'chai'
import { BigNumber } from 'ethers'

import { loadOrGetSymbiosisBridgeData } from '../helpers/symbiosis'

/* eslint-disable no-secrets/no-secrets */

function itBridgesProperly(sourceChainId: number, destinationChainId: number, tokenOutAddress: string) {
  if (destinationChainId != sourceChainId) {
    it('should send the tokens to the gateway', async function () {
      const previousSenderBalance = await this.token.balanceOf(this.whale.address)
      const previousConnectorBalance = await this.token.balanceOf(this.connector.address)

      await this.token.connect(this.whale).transfer(this.connector.address, this.amount)

      const data = await loadOrGetSymbiosisBridgeData(
        sourceChainId,
        destinationChainId,
        this.connector,
        this.token,
        tokenOutAddress,
        this.amount,
        this.slippage
      )

      await this.connector.connect(this.whale).execute(this.token.address, this.amount, data)

      const currentSenderBalance = await this.token.balanceOf(this.whale.address)
      expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(this.amount))

      const currentConnectorBalance = await this.token.balanceOf(this.connector.address)
      expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
    })
  }
}

export function itBehavesLikeSymbiosisConnectorBridgingUSDC(
  sourceChainId: number,
  tokenAddress: string,
  amount: BigNumber,
  whaleAddress: string,
  slippage: number
): void {
  before('load tokens and accounts', async function () {
    this.token = await instanceAt('IERC20Metadata', tokenAddress)
    this.whale = await impersonate(whaleAddress, fp(100))
  })

  before('set amount and slippage', function () {
    this.amount = amount
    this.slippage = slippage
  })

  context('bridge to arbitrum', () => {
    const destinationChainId = 42161
    const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'

    itBridgesProperly(sourceChainId, destinationChainId, USDC)
  })

  context('bridge to mainnet', () => {
    const destinationChainId = 1
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    itBridgesProperly(sourceChainId, destinationChainId, USDC)
  })

  context('bridge to zkEVM', () => {
    const destinationChainId = 1101
    const USDC = '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035'

    itBridgesProperly(sourceChainId, destinationChainId, USDC)
  })
}

export function itBehavesLikeSymbiosisConnectorBridgingWETH(
  sourceChainId: number,
  tokenAddress: string,
  amount: BigNumber,
  whaleAddress: string,
  slippage: number
): void {
  before('load tokens and accounts', async function () {
    this.token = await instanceAt('IERC20Metadata', tokenAddress)
    this.whale = await impersonate(whaleAddress, fp(100))
  })

  before('set amount and slippage', function () {
    this.amount = amount
    this.slippage = slippage
  })

  context('bridge to arbitrum', () => {
    const destinationChainId = 42161
    const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'

    itBridgesProperly(sourceChainId, destinationChainId, WETH)
  })

  context('bridge to mainnet', () => {
    const destinationChainId = 1
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

    itBridgesProperly(sourceChainId, destinationChainId, WETH)
  })

  context('bridge to zkEVM', () => {
    const destinationChainId = 1101
    const WETH = '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9'

    itBridgesProperly(sourceChainId, destinationChainId, WETH)
  })
}
