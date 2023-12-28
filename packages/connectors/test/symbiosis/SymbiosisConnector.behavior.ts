import { fp, impersonate, instanceAt } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { getSymbiosisBridgeData } from '../../src/symbiosis'

/* eslint-disable no-secrets/no-secrets */

export enum Token {
  /* eslint-disable no-unused-vars */
  USDC,
  WETH,
  /* eslint-enable no-unused-vars */
}

export function itBehavesLikeSymbiosisConnector(
  sourceChainId: number,
  tokenAddress: string,
  tokenName: Token,
  amount: BigNumber,
  whaleAddress: string,
  slippage: number
): void {
  let token: Contract, whale: SignerWithAddress

  before('load tokens and accounts', async function () {
    token = await instanceAt('IERC20Metadata', tokenAddress)
    whale = await impersonate(whaleAddress, fp(100))
  })

  function bridgesProperly(destinationChainId: number, tokenOutAddress: string) {
    if (destinationChainId != sourceChainId) {
      it('should send the tokens to the gateway', async function () {
        const previousSenderBalance = await token.balanceOf(whale.address)
        const previousConnectorBalance = await token.balanceOf(this.connector.address)

        await token.connect(whale).transfer(this.connector.address, amount)

        const data = await getSymbiosisBridgeData(
          sourceChainId,
          destinationChainId,
          this.connector,
          token,
          tokenOutAddress,
          amount,
          slippage
        )
        await this.connector.connect(whale).execute(tokenAddress, amount, data)

        const currentSenderBalance = await token.balanceOf(whale.address)
        expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(amount))

        const currentConnectorBalance = await token.balanceOf(this.connector.address)
        expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
      })
    }
  }

  function getTokenOut(token: Token, USDC: string, WETH: string) {
    return token == Token.USDC ? USDC : WETH
  }

  context('bridge to optimism', () => {
    const destinationChainId = 10
    const USDC = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
    const WETH = '0x4200000000000000000000000000000000000006'
    const tokenOut = getTokenOut(tokenName, USDC, WETH)

    bridgesProperly(destinationChainId, tokenOut)
  })

  context('bridge to polygon', () => {
    const destinationChainId = 137
    const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
    const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
    const tokenOut = getTokenOut(tokenName, USDC, WETH)

    bridgesProperly(destinationChainId, tokenOut)
  })

  context('bridge to bsc', () => {
    const destinationChainId = 56
    const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
    const WETH = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'
    const tokenOut = getTokenOut(tokenName, USDC, WETH)

    bridgesProperly(destinationChainId, tokenOut)
  })

  context('bridge to arbitrum', () => {
    const destinationChainId = 42161
    const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
    const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
    const tokenOut = getTokenOut(tokenName, USDC, WETH)

    bridgesProperly(destinationChainId, tokenOut)
  })

  context('bridge to mainnet', () => {
    const destinationChainId = 1
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    const tokenOut = getTokenOut(tokenName, USDC, WETH)

    bridgesProperly(destinationChainId, tokenOut)
  })

  context('bridge to zkEVM', () => {
    const destinationChainId = 1101
    const USDC = '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035'
    const WETH = '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9'
    const tokenOut = getTokenOut(tokenName, USDC, WETH)

    bridgesProperly(destinationChainId, tokenOut)
  })
}
