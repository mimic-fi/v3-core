import {
  assertEvent,
  BigNumberish,
  deployTokenMock,
  fp,
  ONES_ADDRESS,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

export function itBehavesLikeBaseBridgeTask(executionType: string): void {
  describe('execution type', () => {
    it('defines it correctly', async function () {
      const expectedType = ethers.utils.solidityKeccak256(['string'], [executionType])
      expect(await this.task.EXECUTION_TYPE()).to.be.equal(expectedType)
    })
  })

  describe('setBalanceConnectors', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setBalanceConnectorsRole = this.task.interface.getSighash('setBalanceConnectors')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setBalanceConnectorsRole, [])
        this.task = this.task.connect(this.owner)
      })

      const itCanBeSet = (previous: string, next: string) => {
        it('can be set', async function () {
          const tx = await this.task.setBalanceConnectors(previous, next)

          expect(await this.task.previousBalanceConnectorId()).to.be.equal(previous)
          expect(await this.task.nextBalanceConnectorId()).to.be.equal(next)

          await assertEvent(tx, 'BalanceConnectorsSet', { previous, next })
        })
      }

      context('when setting to non-zero', () => {
        const previous = '0x0000000000000000000000000000000000000000000000000000000000000001'

        context('when setting next to zero', () => {
          const next = ZERO_BYTES32

          itCanBeSet(previous, next)
        })

        context('when setting next to non-zero', () => {
          const next = '0x0000000000000000000000000000000000000000000000000000000000000002'

          it('reverts', async function () {
            await expect(this.task.setBalanceConnectors(previous, next)).to.be.revertedWith('TaskNextConnectorNotZero')
          })
        })
      })

      context('when setting to zero', () => {
        const previous = ZERO_BYTES32
        const next = ZERO_BYTES32

        itCanBeSet(previous, next)
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setBalanceConnectors(ZERO_BYTES32, ZERO_BYTES32)).to.be.revertedWith(
          'AuthSenderNotAllowed'
        )
      })
    })
  })

  describe('setConnector', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setConnectorRole = this.task.interface.getSighash('setConnector')
        await this.authorizer.connect(this.owner).authorize(this.owner.address, this.task.address, setConnectorRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the new connector is not zero', () => {
        let connector: Contract

        beforeEach('deploy connector', async function () {
          connector = await deployTokenMock('TKN')
        })

        it('sets the token out', async function () {
          await this.task.setConnector(connector.address)

          expect(await this.task.connector()).to.be.equal(connector.address)
        })

        it('emits an event', async function () {
          const tx = await this.task.setConnector(connector.address)

          await assertEvent(tx, 'ConnectorSet', { connector })
        })
      })

      context('when the new connector is zero', () => {
        const connector = ZERO_ADDRESS

        it('reverts', async function () {
          await expect(this.task.setConnector(connector)).to.be.revertedWith('TaskConnectorZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setConnector(ZERO_ADDRESS)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setRecipient', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setRecipientRole = this.task.interface.getSighash('setRecipient')
        await this.authorizer.connect(this.owner).authorize(this.owner.address, this.task.address, setRecipientRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the recipient is not zero', () => {
        const recipient = ONES_ADDRESS

        it('sets the recipient', async function () {
          await this.task.setRecipient(recipient)
          expect(await this.task.recipient()).to.be.equal(recipient)
        })

        it('emits an event', async function () {
          const tx = await this.task.setRecipient(recipient)
          await assertEvent(tx, 'RecipientSet', { recipient })
        })
      })

      context('when the recipient is zero', () => {
        const recipient = ZERO_ADDRESS

        it('reverts', async function () {
          await expect(this.task.setRecipient(recipient)).to.be.revertedWith('TaskRecipientZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setRecipient(ZERO_ADDRESS)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setDefaultDestinationChain', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setDestinationChainRole = this.task.interface.getSighash('setDefaultDestinationChain')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setDestinationChainRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when setting the destination chain', () => {
        const itSetsTheChainCorrectly = () => {
          context('when the destination chain is not the current one', () => {
            const chainId = 1

            it('sets the destination chain', async function () {
              await this.task.setDefaultDestinationChain(chainId)

              expect(await this.task.defaultDestinationChain()).to.be.equal(chainId)
            })

            it('emits an event', async function () {
              const tx = await this.task.setDefaultDestinationChain(chainId)

              await assertEvent(tx, 'DefaultDestinationChainSet', { defaultDestinationChain: chainId })
            })
          })

          context('when the destination chain is the current one', () => {
            const chainId = 31337 // Hardhat destination chain

            it('reverts', async function () {
              await expect(this.task.setDefaultDestinationChain(chainId)).to.be.revertedWith('TaskBridgeCurrentChainId')
            })
          })
        }

        context('when the destination chain was set', () => {
          beforeEach('set destination chain', async function () {
            await this.task.setDefaultDestinationChain(1)
          })

          itSetsTheChainCorrectly()
        })

        context('when the destination chain was not set', () => {
          beforeEach('unset destination chain', async function () {
            await this.task.setDefaultDestinationChain(0)
          })

          itSetsTheChainCorrectly()
        })
      })

      context('when unsetting the destination chain', () => {
        const itUnsetsTheChainCorrectly = () => {
          it('unsets the destination chain', async function () {
            await this.task.setDefaultDestinationChain(0)

            expect(await this.task.defaultDestinationChain()).to.be.equal(0)
          })

          it('emits an event', async function () {
            const tx = await this.task.setDefaultDestinationChain(0)

            await assertEvent(tx, 'DefaultDestinationChainSet', { defaultDestinationChain: 0 })
          })
        }

        context('when the destination chain was set', () => {
          beforeEach('set destination chain', async function () {
            await this.task.setDefaultDestinationChain(1)
          })

          itUnsetsTheChainCorrectly()
        })

        context('when the destination chain was not set', () => {
          beforeEach('unset destination chain', async function () {
            await this.task.setDefaultDestinationChain(0)
          })

          itUnsetsTheChainCorrectly()
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setDefaultDestinationChain(1)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setCustomDestinationChain', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setCustomDestinationChainRole = this.task.interface.getSighash('setCustomDestinationChain')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setCustomDestinationChainRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when setting the destination chain', () => {
        context('when the destination chain is not the current one', () => {
          const chainId = 1

          const itSetsTheChainCorrectly = () => {
            it('sets the destination chain', async function () {
              await this.task.setCustomDestinationChain(token.address, chainId)

              const destinationChain = await this.task.customDestinationChain(token.address)
              expect(destinationChain).to.be.equal(chainId)
            })

            it('emits an event', async function () {
              const tx = await this.task.setCustomDestinationChain(token.address, chainId)

              await assertEvent(tx, 'CustomDestinationChainSet', { token, destinationChain: chainId })
            })
          }

          context('when the destination chain was set', () => {
            beforeEach('set destination chain', async function () {
              await this.task.setCustomDestinationChain(token.address, 1)
            })

            itSetsTheChainCorrectly()
          })

          context('when the destination chain was not set', () => {
            beforeEach('unset destination chain', async function () {
              await this.task.setCustomDestinationChain(token.address, 0)
            })

            itSetsTheChainCorrectly()
          })
        })

        context('when the destination chain is the current one', () => {
          const chainId = 31337 // Hardhat destination chain

          it('reverts', async function () {
            await expect(this.task.setCustomDestinationChain(token.address, chainId)).to.be.revertedWith(
              'TaskBridgeCurrentChainId'
            )
          })
        })
      })

      context('when unsetting the destination chain', () => {
        const itUnsetsTheChainCorrectly = () => {
          it('unsets the destination chain', async function () {
            await this.task.setCustomDestinationChain(token.address, 0)

            const destinationChain = await this.task.customDestinationChain(token.address)
            expect(destinationChain).to.be.equal(0)
          })

          it('emits an event', async function () {
            const tx = await this.task.setCustomDestinationChain(token.address, 0)

            await assertEvent(tx, 'CustomDestinationChainSet', { token, destinationChain: 0 })
          })
        }

        context('when the destination chain was set', () => {
          beforeEach('set destination chain', async function () {
            await this.task.setCustomDestinationChain(token.address, 1)
          })

          itUnsetsTheChainCorrectly()
        })

        context('when the destination chain was not set', () => {
          beforeEach('unset destination chain', async function () {
            await this.task.setCustomDestinationChain(token.address, 0)
          })

          itUnsetsTheChainCorrectly()
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setCustomDestinationChain(ZERO_ADDRESS, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setDefaultMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setDefaultMaxSlippageRole = this.task.interface.getSighash('setDefaultMaxSlippage')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setDefaultMaxSlippageRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await this.task.setDefaultMaxSlippage(slippage)

          expect(await this.task.defaultMaxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await this.task.setDefaultMaxSlippage(slippage)

          await assertEvent(tx, 'DefaultMaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(this.task.setDefaultMaxSlippage(slippage)).to.be.revertedWith('TaskSlippageAboveOne')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setDefaultMaxSlippage(1)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setCustomMaxSlippage', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomMaxSlippageRole = this.task.interface.getSighash('setCustomMaxSlippage')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setCustomMaxSlippageRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await this.task.setCustomMaxSlippage(token.address, slippage)

          expect(await this.task.customMaxSlippage(token.address)).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await this.task.setCustomMaxSlippage(token.address, slippage)

          await assertEvent(tx, 'CustomMaxSlippageSet', { token, maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(this.task.setCustomMaxSlippage(token.address, slippage)).to.be.revertedWith(
            'TaskSlippageAboveOne'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setCustomMaxSlippage(ZERO_ADDRESS, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setDefaultMaxFee', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setDefaultMaxFeeRole = this.task.interface.getSighash('setDefaultMaxFee')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setDefaultMaxFeeRole, [])
        this.task = this.task.connect(this.owner)
      })

      const itCanBeSet = (maxFeeToken: string, maxFee: BigNumberish) => {
        it('sets the default max fee', async function () {
          await this.task.setDefaultMaxFee(maxFeeToken, maxFee)

          const defaultMaxFee = await this.task.defaultMaxFee()
          expect(defaultMaxFee.token).to.be.equal(maxFeeToken)
          expect(defaultMaxFee.maxFee).to.be.equal(maxFee)
        })

        it('emits an event', async function () {
          const tx = await this.task.setDefaultMaxFee(maxFeeToken, maxFee)

          await assertEvent(tx, 'DefaultMaxFeeSet', { token: maxFeeToken, maxFee })
        })
      }

      context('when the max fee token is not zero', () => {
        const maxFeeToken = ONES_ADDRESS
        const maxFee = 5

        itCanBeSet(maxFeeToken, maxFee)
      })

      context('when the max fee token is zero', () => {
        const maxFeeToken = ZERO_ADDRESS

        context('when the max fee is zero', () => {
          const maxFee = 0

          itCanBeSet(maxFeeToken, maxFee)
        })

        context('when the max fee is not zero', () => {
          const maxFee = 1

          it('reverts', async function () {
            await expect(this.task.setDefaultMaxFee(maxFeeToken, maxFee)).to.be.revertedWith('TaskInvalidMaxFee')
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setDefaultMaxFee(ZERO_ADDRESS, 1)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setCustomMaxFee', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setCustomMaxFeeRole = this.task.interface.getSighash('setCustomMaxFee')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setCustomMaxFeeRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the token is not zero', () => {
        const itCanBeSet = (maxFeeToken: string, maxFee: BigNumberish) => {
          it('sets the max fee', async function () {
            await this.task.setCustomMaxFee(token.address, maxFeeToken, maxFee)

            const customMaxFee = await this.task.customMaxFee(token.address)
            expect(customMaxFee.token).to.be.equal(maxFeeToken)
            expect(customMaxFee.maxFee).to.be.equal(maxFee)
          })

          it('emits an event', async function () {
            const tx = await this.task.setCustomMaxFee(token.address, maxFeeToken, maxFee)

            await assertEvent(tx, 'CustomMaxFeeSet', { token, maxFeeToken, maxFee })
          })
        }

        context('when the max fee token is not zero', () => {
          const maxFeeToken = ONES_ADDRESS
          const maxFee = 5

          itCanBeSet(maxFeeToken, maxFee)
        })

        context('when the max fee token is zero', () => {
          const maxFeeToken = ZERO_ADDRESS

          context('when the max fee is zero', () => {
            const maxFee = 0

            itCanBeSet(maxFeeToken, maxFee)
          })

          context('when the max fee is not zero', () => {
            const maxFee = 1

            it('reverts', async function () {
              await expect(this.task.setCustomMaxFee(token.address, maxFeeToken, maxFee)).to.be.revertedWith(
                'TaskInvalidMaxFee'
              )
            })
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async function () {
          await expect(this.task.setCustomMaxFee(token, ZERO_ADDRESS, 0)).to.be.revertedWith('TaskTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setCustomMaxFee(ZERO_ADDRESS, ZERO_ADDRESS, 0)).to.be.revertedWith(
          'AuthSenderNotAllowed'
        )
      })
    })
  })
}
