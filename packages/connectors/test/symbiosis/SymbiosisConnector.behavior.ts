import { fp, impersonate, instanceAt } from '@mimic-fi/v3-helpers'
import { expect } from 'chai'
import { BigNumber } from 'ethers'

import { getSymbiosisBridgeData } from '../../src/symbiosis'

/* eslint-disable no-secrets/no-secrets */

function itBridgesProperly(sourceChainId: number, destinationChainId: number, tokenOutAddress: string) {
  if (destinationChainId != sourceChainId) {
    it('should send the tokens to the gateway', async function () {
      const previousSenderBalance = await this.token.balanceOf(this.whale.address)
      const previousConnectorBalance = await this.token.balanceOf(this.connector.address)

      await this.token.connect(this.whale).transfer(this.connector.address, this.amount)

      const data = await getSymbiosisBridgeData(
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

  context('bridge to optimism', () => {
    const destinationChainId = 10
    const USDC = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'

    itBridgesProperly(sourceChainId, destinationChainId, USDC)
  })

  context('bridge to polygon', () => {
    const destinationChainId = 137
    const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'

    itBridgesProperly(sourceChainId, destinationChainId, USDC)
  })

  context('bridge to bsc', () => {
    const destinationChainId = 56
    const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'

    itBridgesProperly(sourceChainId, destinationChainId, USDC)
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

  context('bridge to optimism', () => {
    const destinationChainId = 10
    const WETH = '0x4200000000000000000000000000000000000006'

    itBridgesProperly(sourceChainId, destinationChainId, WETH)
  })

  context('bridge to polygon', () => {
    const destinationChainId = 137
    const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'

    itBridgesProperly(sourceChainId, destinationChainId, WETH)
  })

  context('bridge to bsc', () => {
    const destinationChainId = 56
    const WETH = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'

    itBridgesProperly(sourceChainId, destinationChainId, WETH)
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
