import { fp, impersonate, instanceAt } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { loadOrGetSocketData } from '../helpers/socket'

/* eslint-disable no-secrets/no-secrets */

export function itBehavesLikeSocketConnector(
  fromChainId: number,
  fromTokenAddress: string,
  fromAmount: BigNumber,
  toChainId: number,
  toTokenAddress: string,
  whaleAddress: string
): void {
  const slippage = 0.02
  let fromToken: Contract, toToken: Contract, whale: SignerWithAddress

  before('load tokens and accounts', async function () {
    fromToken = await instanceAt('IERC20Metadata', fromTokenAddress)
    toToken = await instanceAt('IERC20Metadata', toTokenAddress)
    whale = await impersonate(whaleAddress, fp(100))
  })

  it('should send the tokens to the socket gateway', async function () {
    const previousSenderBalance = await fromToken.balanceOf(whaleAddress)
    const previousConnectorBalance = await fromToken.balanceOf(this.connector.address)

    await fromToken.connect(whale).transfer(this.connector.address, fromAmount)

    const data = await loadOrGetSocketData(
      this.connector,
      fromChainId,
      fromToken,
      fromAmount,
      toChainId,
      toToken,
      slippage
    )

    await this.connector.connect(whale).execute(fromTokenAddress, fromAmount, data)

    const currentSenderBalance = await fromToken.balanceOf(whaleAddress)
    expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(fromAmount))

    const currentConnectorBalance = await fromToken.balanceOf(this.connector.address)
    expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
  })
}
