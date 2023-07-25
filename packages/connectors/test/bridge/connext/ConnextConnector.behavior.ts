import { fp, impersonate, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

export function itBehavesLikeConnextConnector(
  sourceChainId: number,
  tokenAddress: string,
  amountIn: BigNumber,
  connextAddress: string,
  whaleAddress: string
): void {
  let token: Contract, whale: SignerWithAddress

  before('load tokens and accounts', async function () {
    token = await instanceAt('IERC20Metadata', tokenAddress)
    whale = await impersonate(whaleAddress, fp(100))
  })

  context('when the recipient is not the zero address', async () => {
    const slippage = 0.5
    const relayerFee = amountIn.div(10)

    let minAmountOut: BigNumber, amountInAfterFees: BigNumber

    beforeEach('set min amount out', async () => {
      amountInAfterFees = amountIn.sub(relayerFee)
      minAmountOut = amountInAfterFees.mul(fp(1).sub(fp(slippage))).div(fp(1))
    })

    function bridgesProperly(destinationChainId: number) {
      if (destinationChainId != sourceChainId) {
        it('should send the tokens to the gateway', async function () {
          const previousSenderBalance = await token.balanceOf(whale.address)
          const previousGatewayBalance = await token.balanceOf(connextAddress)
          const previousConnectorBalance = await token.balanceOf(this.connector.address)

          await token.connect(whale).transfer(this.connector.address, amountIn)
          await this.connector
            .connect(whale)
            .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address, relayerFee)

          const currentSenderBalance = await token.balanceOf(whale.address)
          expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(amountIn))

          const amountInAfterFees = amountIn.sub(relayerFee)
          const currentGatewayBalance = await token.balanceOf(connextAddress)
          expect(currentGatewayBalance).to.be.equal(previousGatewayBalance.add(amountInAfterFees))

          const currentConnectorBalance = await token.balanceOf(this.connector.address)
          expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
        })

        context('when relayerFee is greater than amountIn', () => {
          const relayerFee = amountIn.add(1)

          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address, relayerFee)
            ).to.be.revertedWith('ConnextBridgeRelayerFeeGTAmount')
          })
        })

        context('when minAmountOut is greater than amountIn minus relayerFee', () => {
          const minAmountOut = amountIn.add(1)

          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address, relayerFee)
            ).to.be.revertedWith('ConnextBridgeMinAmountOutTooBig').withArgs(minAmountOut, amountIn, relayerFee)
          })
        })
      } else {
        it('reverts', async function () {
          await expect(
            this.connector
              .connect(whale)
              .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address, relayerFee)
          ).to.be.revertedWith('ConnextBridgeSameChain').withArgs(destinationChainId)
        })
      }
    }

    context('bridge to optimism', () => {
      const destinationChainId = 10

      bridgesProperly(destinationChainId)
    })

    context('bridge to polygon', () => {
      const destinationChainId = 137

      bridgesProperly(destinationChainId)
    })

    context('bridge to bsc', () => {
      const destinationChainId = 56

      bridgesProperly(destinationChainId)
    })

    context('bridge to arbitrum', () => {
      const destinationChainId = 42161

      bridgesProperly(destinationChainId)
    })

    context('bridge to gnosis', () => {
      const destinationChainId = 100

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
          this.connector
            .connect(whale)
            .execute(destinationChainId, tokenAddress, amountIn, minAmountOut, whale.address, relayerFee)
        ).to.be.revertedWith('ConnextBridgeUnknownChainId').withArgs(destinationChainId)
      })
    })
  })

  context('when the recipient is the zero address', async () => {
    it('reverts', async function () {
      await expect(this.connector.connect(whale).execute(0, tokenAddress, 0, 0, ZERO_ADDRESS, 0)).to.be.revertedWith(
        'ConnextBridgeRecipientZero'
      )
    })
  })
}
