import { fp, impersonate, instanceAt, MAX_UINT256, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { getHopBonderFee } from '../../../src/hop'

export function itBehavesLikeHopNativeConnector(
  sourceChainId: number,
  wrappedNativeTokenAddress: string,
  nativeTokenAmmAddress: string,
  whaleAddress: string,
  ignoreChains: number[] = []
): void {
  let whale: SignerWithAddress
  let wrappedNativeToken: Contract, amm: Contract, hToken: Contract, ammExchangeAddress: string

  before('load tokens and accounts', async function () {
    wrappedNativeToken = await instanceAt('IERC20Metadata', wrappedNativeTokenAddress)
    whale = await impersonate(whaleAddress, fp(100))
  })

  beforeEach('load hop AMM', async function () {
    amm = await instanceAt('IHopL2AMM', nativeTokenAmmAddress)
    hToken = await instanceAt('IERC20', await amm.hToken())
    ammExchangeAddress = await amm.exchangeAddress()
  })

  context('when the recipient is not the zero address', async () => {
    let amountIn: BigNumber, minAmountOut: BigNumber, bonderFee: BigNumber

    const slippage = 0.01
    const deadline = MAX_UINT256

    beforeEach('set amount in', async () => {
      amountIn = sourceChainId === 137 || sourceChainId === 100 ? fp(100) : fp(4)
      minAmountOut = amountIn.sub(amountIn.mul(fp(slippage)).div(fp(1)))
    })

    function bridgesFromL2Properly(destinationChainId: number) {
      if (!ignoreChains.includes(destinationChainId)) {
        if (destinationChainId != sourceChainId) {
          beforeEach('estimate bonder fee and compute data', async function () {
            bonderFee = await getHopBonderFee(sourceChainId, destinationChainId, wrappedNativeToken, amountIn, slippage)
          })

          it('should send the canonical tokens to the exchange', async function () {
            const previousSenderBalance = await wrappedNativeToken.balanceOf(whale.address)
            const previousExchangeBalance = await wrappedNativeToken.balanceOf(ammExchangeAddress)
            const previousConnectorBalance = await wrappedNativeToken.balanceOf(this.connector.address)

            await wrappedNativeToken.connect(whale).transfer(this.connector.address, amountIn)
            await this.connector
              .connect(whale)
              .execute(
                destinationChainId,
                wrappedNativeTokenAddress,
                amountIn,
                minAmountOut,
                whale.address,
                nativeTokenAmmAddress,
                deadline,
                ZERO_ADDRESS,
                bonderFee
              )

            const currentSenderBalance = await wrappedNativeToken.balanceOf(whale.address)
            expect(currentSenderBalance).to.be.equal(previousSenderBalance.sub(amountIn))

            const currentExchangeBalance = await wrappedNativeToken.balanceOf(ammExchangeAddress)
            expect(currentExchangeBalance).to.be.equal(previousExchangeBalance.add(amountIn))

            const currentConnectorBalance = await wrappedNativeToken.balanceOf(this.connector.address)
            expect(currentConnectorBalance).to.be.equal(previousConnectorBalance)
          })

          it('should burn at least the requested hop tokens', async function () {
            const previousHopTokenSupply = await hToken.totalSupply()

            await wrappedNativeToken.connect(whale).transfer(this.connector.address, amountIn)
            await this.connector
              .connect(whale)
              .execute(
                destinationChainId,
                wrappedNativeTokenAddress,
                amountIn,
                minAmountOut,
                whale.address,
                nativeTokenAmmAddress,
                deadline,
                ZERO_ADDRESS,
                bonderFee
              )

            const currentHopTokenSupply = await hToken.totalSupply()
            const burnedAmount = previousHopTokenSupply.sub(currentHopTokenSupply)
            expect(burnedAmount).to.be.at.least(minAmountOut)
          })

          it('does not affect the canonical token balance of the amm', async function () {
            const previousAmmTokenBalance = await wrappedNativeToken.balanceOf(nativeTokenAmmAddress)

            await wrappedNativeToken.connect(whale).transfer(this.connector.address, amountIn)
            await this.connector
              .connect(whale)
              .execute(
                destinationChainId,
                wrappedNativeTokenAddress,
                amountIn,
                minAmountOut,
                whale.address,
                nativeTokenAmmAddress,
                deadline,
                ZERO_ADDRESS,
                bonderFee
              )

            const currentAmmTokenBalance = await wrappedNativeToken.balanceOf(nativeTokenAmmAddress)
            expect(currentAmmTokenBalance).to.be.equal(previousAmmTokenBalance)
          })
        } else {
          it('reverts', async function () {
            await expect(
              this.connector
                .connect(whale)
                .execute(
                  destinationChainId,
                  wrappedNativeTokenAddress,
                  amountIn,
                  minAmountOut,
                  whale.address,
                  nativeTokenAmmAddress,
                  0,
                  ZERO_ADDRESS,
                  0
                )
            ).to.be.revertedWith('HOP_BRIDGE_SAME_CHAIN')
          })
        }
      }
    }

    context('bridge to optimism', function () {
      const destinationChainId = 10

      bridgesFromL2Properly(destinationChainId)
    })

    context('bridge to polygon', function () {
      const destinationChainId = 137

      bridgesFromL2Properly(destinationChainId)
    })

    context('bridge to gnosis', function () {
      const destinationChainId = 100

      bridgesFromL2Properly(destinationChainId)
    })

    context('bridge to arbitrum', function () {
      const destinationChainId = 42161

      bridgesFromL2Properly(destinationChainId)
    })

    context('bridge to mainnet', function () {
      const destinationChainId = 1

      bridgesFromL2Properly(destinationChainId)
    })

    context('bridge to goerli', function () {
      const destinationChainId = 5

      it('reverts', async function () {
        await expect(
          this.connector
            .connect(whale)
            .execute(
              destinationChainId,
              wrappedNativeTokenAddress,
              0,
              0,
              whale.address,
              nativeTokenAmmAddress,
              deadline,
              ZERO_ADDRESS,
              0
            )
        ).to.be.reverted
      })
    })
  })

  context('when the recipient is the zero address', async () => {
    it('reverts', async function () {
      await expect(
        this.connector
          .connect(whale)
          .execute(0, wrappedNativeTokenAddress, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, 0, ZERO_ADDRESS, 0)
      ).to.be.revertedWith('HOP_BRIDGE_RECIPIENT_ZERO')
    })
  })
}
