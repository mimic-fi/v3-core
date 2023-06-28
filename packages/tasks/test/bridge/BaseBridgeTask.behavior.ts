import { assertEvent, deploy, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

export function itBehavesLikeBaseBridgeTask(): void {
  describe('setConnector', () => {
    let connector: Contract

    beforeEach('deploy connector', async function () {
      connector = await deploy('TokenMock', ['TKN'])
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setConnectorRole = this.task.interface.getSighash('setConnector')
        await this.authorizer.connect(this.owner).authorize(this.owner.address, this.task.address, setConnectorRole, [])
        this.task = this.task.connect(this.owner)
      })

      it('sets the connector', async function () {
        await this.task.setConnector(connector.address)

        expect(await this.task.connector()).to.be.equal(connector.address)
      })

      it('emits an event', async function () {
        const tx = await this.task.setConnector(connector.address)

        await assertEvent(tx, 'ConnectorSet', { connector })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setConnector(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
              await expect(this.task.setDefaultDestinationChain(chainId)).to.be.revertedWith(
                'TASK_BRIDGE_CURRENT_CHAIN_ID'
              )
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
        await expect(this.task.setDefaultDestinationChain(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomDestinationChain', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deploy('TokenMock', ['TKN'])
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
              expect(destinationChain[0]).to.be.true
              expect(destinationChain[1]).to.be.equal(chainId)
            })

            it('emits an event', async function () {
              const tx = await this.task.setCustomDestinationChain(token.address, chainId)

              await assertEvent(tx, 'CustomDestinationChainSet', { token, defaultDestinationChain: chainId })
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
              'TASK_BRIDGE_CURRENT_CHAIN_ID'
            )
          })
        })
      })

      context('when unsetting the destination chain', () => {
        const itUnsetsTheChainCorrectly = () => {
          it('unsets the destination chain', async function () {
            await this.task.setCustomDestinationChain(token.address, 0)

            const destinationChain = await this.task.customDestinationChain(token.address)
            expect(destinationChain[0]).to.be.false
            expect(destinationChain[1]).to.be.equal(0)
          })

          it('emits an event', async function () {
            const tx = await this.task.setCustomDestinationChain(token.address, 0)

            await assertEvent(tx, 'CustomDestinationChainSet', { token, defaultDestinationChain: 0 })
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
        await expect(this.task.setCustomDestinationChain(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
}
