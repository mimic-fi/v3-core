import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  BigNumberish,
  deploy,
  deployProxy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'

describe('RelayerDepositor', () => {
  let task: Contract, relayer: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    relayer = await deploy('RelayerMock', [])
    task = await deployProxy('RelayerDepositor', [], [buildEmptyTaskConfig(owner, smartVault), relayer.address])
  })

  describe('initialization', async () => {
    it('has a relayer reference', async () => {
      expect(await task.relayer()).to.be.equal(relayer.address)
    })

    it('cannot be initialized twice', async () => {
      await expect(task.initialize(buildEmptyTaskConfig(owner, smartVault), relayer.address)).to.be.revertedWith(
        'Initializable: contract is already initialized'
      )
    })
  })

  describe('setRelayer', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setRelayerRole = task.interface.getSighash('setRelayer')
        await authorizer.connect(owner).authorize(owner.address, task.address, setRelayerRole, [])
        task = task.connect(owner)
      })

      context('when the relayer is not zero', () => {
        it('sets the relayer', async () => {
          await task.setRelayer(relayer.address)

          expect(await task.relayer()).to.be.equal(relayer.address)
        })

        it('emits an event', async () => {
          const tx = await task.setRelayer(relayer.address)

          await assertEvent(tx, 'RelayerSet', { relayer })
        })
      })

      context('when the relayer is zero', () => {
        it('reverts', async () => {
          await expect(task.setRelayer(ZERO_ADDRESS)).to.be.revertedWith('TaskRelayerZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setRelayer(relayer.address)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('call', () => {
    const token = NATIVE_TOKEN_ADDRESS

    beforeEach('authorize task', async () => {
      const callRole = smartVault.interface.getSighash('call')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, callRole, [])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the given amount is greater than zero', () => {
        const amount = fp(100)

        beforeEach('fund smart vault', async () => {
          await owner.sendTransaction({ to: smartVault.address, value: amount.mul(2) })
        })

        context('when the threshold has passed', () => {
          const threshold = amount

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(token, threshold, 0)
          })

          const itExecutesTheTaskProperly = (requestedAmount: BigNumberish) => {
            it('calls the call function', async () => {
              const tx = await task.call(token, requestedAmount)

              const data = relayer.interface.encodeFunctionData('deposit', [smartVault.address, amount])
              await assertIndirectEvent(tx, smartVault.interface, 'Called', {
                target: relayer,
                value: amount,
                data,
                result: '0x',
              })

              await assertIndirectEvent(tx, relayer.interface, 'Deposited', { smartVault: smartVault.address, amount })
            })

            it('emits an Executed event', async () => {
              const tx = await task.call(token, requestedAmount)
              await assertEvent(tx, 'Executed')
            })
          }

          context('without balance connectors', () => {
            const requestedAmount = amount

            itExecutesTheTaskProperly(requestedAmount)

            it('does not update any balance connectors', async () => {
              const tx = await task.call(token, requestedAmount)

              await assertNoEvent(tx, 'BalanceConnectorUpdated')
            })
          })

          context('with balance connectors', () => {
            const requestedAmount = 0
            const prevConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000001'

            beforeEach('set balance connectors', async () => {
              const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
              await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
              await task.connect(owner).setBalanceConnectors(prevConnectorId, ZERO_BYTES32)
            })

            beforeEach('authorize task to update balance connectors', async () => {
              const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
              await authorizer
                .connect(owner)
                .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
            })

            beforeEach('assign amount in to previous balance connector', async () => {
              const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
              await authorizer
                .connect(owner)
                .authorize(owner.address, smartVault.address, updateBalanceConnectorRole, [])
              await smartVault.connect(owner).updateBalanceConnector(prevConnectorId, token, amount, true)
            })

            itExecutesTheTaskProperly(requestedAmount)

            it('updates the balance connectors properly', async () => {
              const tx = await task.call(token, amount)

              await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                id: prevConnectorId,
                token,
                amount,
                added: false,
              })
            })
          })
        })

        context('when the threshold has not passed', () => {
          const threshold = amount.add(1)

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(NATIVE_TOKEN_ADDRESS, threshold, 0)
          })

          it('reverts', async () => {
            await expect(task.call(token, amount)).to.be.revertedWith('TaskTokenThresholdNotMet')
          })
        })
      })

      context('when the given amount is zero', () => {
        const amount = 0

        it('reverts', async () => {
          await expect(task.call(token, amount)).to.be.revertedWith('TaskAmountZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(token, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
