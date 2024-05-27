import { bn, fp, impersonate, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

export function itBehavesLikeWormholeConnector(
  sourceChainId: number,
  tokenAddress: string,
  whaleAddress: string
): void {
  let token: Contract, whale: SignerWithAddress

  before('load tokens and accounts', async function () {
    token = await instanceAt('IERC20Metadata', tokenAddress)
    whale = await impersonate(whaleAddress, fp(100))
  })

  context('when the recipient is not the zero address', async () => {
    let amount: BigNumber
    let minAmountOut: BigNumber

    const relayerFee = sourceChainId == 1 ? bn(1500000) : bn(35000000)

    beforeEach('set amount and min amount out', async () => {
      const decimals = await token.decimals()
      amount = bn(3000).mul(bn(10).pow(decimals))
      minAmountOut = amount.sub(relayerFee)
    })

    function bridgesProperly(destinationChainId: number) {
      if (destinationChainId != sourceChainId) {
        it('should send the tokens to the gateway', async function () {
          const previousSenderBalance = await token.balanceOf(whale.address)
          const previousTotalSupply = await token.totalSupply()
          const previousConnectorBalance = await token.balanceOf(this.connector.address)

          await token.connect(whale).transfer(this.connector.address, amount)
          await this.connector
            .connect(whale)
            .execute(destinationChainId, tokenAddress, amount, minAmountOut, whale.address)

          const currentSenderBalance = await token.balanceOf(whale.address)
          expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(amount))

          // check tokens are burnt on the source chain
          const currentTotalSupply = await token.totalSupply()
          expect(currentTotalSupply).to.be.equal(previousTotalSupply.sub(amount))

          const currentConnectorBalance = await token.balanceOf(this.connector.address)
          expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
        })

        context('when relayerFee is greater than amount', () => {
          const amount = relayerFee.div(2)

          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(destinationChainId, tokenAddress, amount, minAmountOut, whale.address)
            ).to.be.revertedWith('WormholeBridgeRelayerFeeGtAmount')
          })
        })

        context('when minAmountOut is greater than amount minus relayerFee', () => {
          let minAmountOut: BigNumber

          beforeEach('set min amount out', async () => {
            minAmountOut = amount.add(1)
          })

          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(destinationChainId, tokenAddress, amount, minAmountOut, whale.address)
            ).to.be.revertedWith('WormholeBridgeMinAmountOutTooBig')
          })
        })
      } else {
        it('reverts', async function () {
          await expect(
            this.connector.connect(whale).execute(destinationChainId, tokenAddress, amount, minAmountOut, whale.address)
          ).to.be.revertedWith('WormholeBridgeSameChain')
        })
      }
    }

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
          this.connector.connect(whale).execute(destinationChainId, tokenAddress, amount, minAmountOut, whale.address)
        ).to.be.revertedWith('WormholeBridgeUnknownChainId')
      })
    })
  })

  context('when the recipient is the zero address', async () => {
    it('reverts', async function () {
      await expect(this.connector.connect(whale).execute(0, tokenAddress, 0, 0, ZERO_ADDRESS)).to.be.revertedWith(
        'WormholeBridgeRecipientZero'
      )
    })
  })
}
