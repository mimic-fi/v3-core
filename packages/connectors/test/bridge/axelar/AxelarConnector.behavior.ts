import { bn, fp, impersonate, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

export function itBehavesLikeAxelarConnector(
  sourceChainId: number,
  tokenAddress: string,
  gatewayAddress: string,
  whaleAddress: string
): void {
  let token: Contract, whale: SignerWithAddress

  before('load tokens and accounts', async function () {
    token = await instanceAt('IERC20Metadata', tokenAddress)
    whale = await impersonate(whaleAddress, fp(100))
  })

  context('when the recipient is not the zero address', async () => {
    let amountIn: BigNumber

    beforeEach('set amount in', async () => {
      const decimals = await token.decimals()
      amountIn = bn(300).mul(bn(10).pow(decimals))
    })

    function bridgesProperly(destinationChainId: number) {
      if (destinationChainId != sourceChainId) {
        it('should send the tokens to the gateway', async function () {
          const previousSenderBalance = await token.balanceOf(whale.address)
          const previousGatewayBalance = await token.balanceOf(gatewayAddress)
          const previousConnectorBalance = await token.balanceOf(this.connector.address)

          await token.connect(whale).transfer(this.connector.address, amountIn)
          await this.connector.connect(whale).execute(destinationChainId, tokenAddress, amountIn, whale.address)

          const currentSenderBalance = await token.balanceOf(whale.address)
          expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(amountIn))

          const currentGatewayBalance = await token.balanceOf(gatewayAddress)
          expect(currentGatewayBalance).to.be.equal(previousGatewayBalance.add(amountIn))

          const currentConnectorBalance = await token.balanceOf(this.connector.address)
          expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
        })
      } else {
        it('reverts', async function () {
          await expect(
            this.connector.connect(whale).execute(destinationChainId, tokenAddress, amountIn, whale.address)
          ).to.be.revertedWith('AxelarBridgeSameChain')
        })
      }
    }

    context('bridge to polygon', () => {
      const destinationChainId = 137

      bridgesProperly(destinationChainId)
    })

    context('bridge to bsc', () => {
      const destinationChainId = 56

      bridgesProperly(destinationChainId)
    })

    context('bridge to fantom', () => {
      const destinationChainId = 250

      bridgesProperly(destinationChainId)
    })

    context('bridge to arbitrum', () => {
      const destinationChainId = 42161

      bridgesProperly(destinationChainId)
    })

    context('bridge to avalanche', () => {
      const destinationChainId = 43114

      bridgesProperly(destinationChainId)
    })

    context('bridge to mainnet', () => {
      const destinationChainId = 1

      bridgesProperly(destinationChainId)
    })

    context('bridge to goerli', () => {
      const destinationChainId = 5

      it('reverts', async function () {
        await expect(
          this.connector.connect(whale).execute(destinationChainId, tokenAddress, amountIn, whale.address)
        ).to.be.revertedWith('AxelarBridgeUnknownChainId')
      })
    })
  })

  context('when the recipient is the zero address', async () => {
    it('reverts', async function () {
      await expect(this.connector.connect(whale).execute(0, tokenAddress, 0, ZERO_ADDRESS)).to.be.revertedWith(
        'AxelarBridgeRecipientZero'
      )
    })
  })
}
