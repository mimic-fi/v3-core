import { bn, fp, impersonate, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

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
    let amountIn: BigNumber
    let minAmountOut: BigNumber

    const relayerFee = sourceChainId == 1 ? bn(270000) : bn(35000000)

    beforeEach('set amount in and min amount out', async () => {
      const decimals = await token.decimals()
      amountIn = bn(300).mul(bn(10).pow(decimals))
      minAmountOut = amountIn.sub(relayerFee)
    })

    function bridgesProperly(destinationChainId: number) {
      if (destinationChainId != sourceChainId) {
        it('should send the tokens to the gateway', async function () {
          const previousSenderBalance = await token.balanceOf(whale.address)
          const previousTotalSupply = await token.totalSupply()
          const previousConnectorBalance = await token.balanceOf(this.connector.address)

          await token.connect(whale).transfer(this.connector.address, amountIn)
          await this.connector
            .connect(whale)
            .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address)

          const currentSenderBalance = await token.balanceOf(whale.address)
          expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(amountIn))

          // check tokens are burnt on the source chain
          const currentTotalSupply = await token.totalSupply()
          expect(currentTotalSupply).to.be.equal(previousTotalSupply.sub(amountIn))

          const currentConnectorBalance = await token.balanceOf(this.connector.address)
          expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
        })

        context('when relayerFee is greater than amountIn', () => {
          const amountIn = relayerFee.sub(1)
          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address)
            ).to.be.revertedWith('WormholeBridgeRelayerFeeGTAmount').withArgs(relayerFee, amountIn)
          })
        })

        context('when minAmountOut is greater than amountIn minus relayerFee', () => {
          const minAmountOut = amountIn.add(1)
          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address)
            ).to.be.revertedWith('WormholeBridgeMinAmountOutTooBig').withArgs(minAmountOut, amountIn, relayerFee)
          })
        })
      } else {
        it('reverts', async function () {
          await expect(
            this.connector
              .connect(whale)
              .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address)
          ).to.be.revertedWith('WormholeBridgeSameChain').withArgs(destinationChainId)
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
          this.connector.connect(whale).execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address)
        ).to.be.revertedWith('WormholeBridgeUnknownChainId').withArgs(destinationChainId)
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
