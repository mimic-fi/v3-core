import { deploy, deployTokenMock, fp, ONES_ADDRESS } from '@mimic-fi/helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

describe('GenericSwapConnector', () => {
  let connector: Contract

  beforeEach('deploy connector', async () => {
    connector = await deploy('GenericSwapConnector')
  })

  describe('execute', () => {
    let tokenIn: Contract, tokenOut: Contract, targetCall: Contract
    let calldata: string

    const amountIn = fp(1)
    const minAmountOut = fp(0.9)
    const targetApproval = ONES_ADDRESS

    beforeEach('deploy tokens', async () => {
      tokenIn = await deployTokenMock('TKN-IN')
      tokenOut = await deployTokenMock('TKN-OUT')
      targetCall = await deploy('GenericSwapTargetMock')
      calldata = targetCall.interface.encodeFunctionData('send', [tokenOut.address])
    })

    context('when the tokens are different', () => {
      context('when connector has enough token in balance', () => {
        beforeEach('mint token in to connector', async () => {
          await tokenIn.mint(connector.address, amountIn)
        })

        context('when target sends enough token out back', () => {
          beforeEach('mint tokenOut to target', async () => {
            await tokenOut.mint(targetCall.address, minAmountOut)
          })

          it('executes successfully and returns amount out', async () => {
            const preBalance = await tokenOut.balanceOf(connector.address)

            await connector.execute(
              tokenIn.address,
              tokenOut.address,
              amountIn,
              minAmountOut,
              targetCall.address,
              targetApproval,
              calldata
            )

            const postBalance = await tokenOut.balanceOf(connector.address)
            expect(postBalance).to.be.gte(preBalance.add(minAmountOut))
          })

          it('grants the target approval properly', async () => {
            const preAllowance = await tokenIn.allowance(connector.address, targetApproval)

            await connector.execute(
              tokenIn.address,
              tokenOut.address,
              amountIn,
              minAmountOut,
              targetCall.address,
              targetApproval,
              calldata
            )

            const postAllowance = await tokenIn.allowance(connector.address, targetApproval)
            expect(postAllowance).to.be.equal(preAllowance.add(amountIn))
          })
        })

        context('when target sends less token out than min amount out', () => {
          beforeEach('mint insufficient token out to target', async () => {
            await tokenOut.mint(targetCall.address, minAmountOut.sub(1))
          })

          it('reverts', async () => {
            await expect(
              connector.execute(
                tokenIn.address,
                tokenOut.address,
                amountIn,
                minAmountOut,
                targetCall.address,
                targetApproval,
                calldata
              )
            ).to.be.revertedWith('GenericSwapBadAmountOut')
          })
        })
      })

      context('when connector does not have enough token in balance', () => {
        beforeEach('mint token in to connector', async () => {
          await tokenIn.mint(connector.address, amountIn.sub(1))
        })

        it('reverts', async () => {
          await expect(
            connector.execute(
              tokenIn.address,
              tokenOut.address,
              amountIn,
              minAmountOut,
              targetCall.address,
              targetApproval,
              calldata
            )
          ).to.be.reverted
        })
      })
    })

    context('when the tokens are the same', () => {
      it('reverts', async () => {
        await expect(
          connector.execute(
            tokenIn.address,
            tokenIn.address,
            amountIn,
            minAmountOut,
            targetCall.address,
            targetApproval,
            calldata
          )
        ).to.be.revertedWith('GenericSwapSameToken')
      })
    })
  })
})
