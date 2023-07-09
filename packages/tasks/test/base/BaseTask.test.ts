import {
  assertEvent,
  assertIndirectEvent,
  assertNoIndirectEvent,
  deploy,
  deployProxy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ONES_BYTES32,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

describe('BaseTask', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'BaseTaskMock',
      [],
      [
        {
          smartVault: smartVault.address,
          previousBalanceConnectorId: ZERO_BYTES32,
          nextBalanceConnectorId: ZERO_BYTES32,
        },
      ]
    )
  })

  describe('initialization', async () => {
    it('cannot be initialized twice', async () => {
      await expect(
        task.initialize({
          smartVault: smartVault.address,
          previousBalanceConnectorId: ZERO_BYTES32,
          nextBalanceConnectorId: ZERO_BYTES32,
        })
      ).to.be.revertedWith('Initializable: contract is already initialized')
    })
  })

  describe('getTaskAmount', () => {
    const balance = fp(0.1)

    context('when the task has no previous balance connector set', () => {
      context('when querying ETH', () => {
        const token = NATIVE_TOKEN_ADDRESS

        beforeEach('fund tokens source', async () => {
          await owner.sendTransaction({ to: smartVault.address, value: balance })
        })

        it('returns zero', async () => {
          expect(await task.getTaskAmount(token)).to.be.equal(0)
        })
      })

      context('when the token is an ERC20', () => {
        let token: Contract

        beforeEach('fund smart vault', async () => {
          token = await deploy('TokenMock', ['USDC'])
          await token.mint(smartVault.address, balance)
        })

        it('tells the tokens source balance', async () => {
          expect(await task.getTaskAmount(token.address)).to.be.equal(0)
        })
      })
    })

    context('when the task has a previous balance connector set', () => {
      const connector = ONES_BYTES32

      beforeEach('set previous balance connector', async () => {
        const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
        await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
        await task.connect(owner).setBalanceConnectors(connector, ZERO_BYTES32)
      })

      context('when querying ETH', () => {
        const token = NATIVE_TOKEN_ADDRESS

        beforeEach('set connector balance', async () => {
          const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, updateBalanceConnectorRole, [])
          await smartVault.connect(owner).updateBalanceConnector(connector, token, balance, true)
        })

        it('tells the connector balance', async () => {
          expect(await task.getTaskAmount(token)).to.be.equal(balance)
        })
      })

      context('when the token is an ERC20', () => {
        let token: Contract

        beforeEach('fund tokens source', async () => {
          token = await deploy('TokenMock', ['USDC'])
        })

        beforeEach('set connector balance', async () => {
          const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, updateBalanceConnectorRole, [])
          await smartVault.connect(owner).updateBalanceConnector(connector, token.address, balance, true)
        })

        it('tells the connector balance', async () => {
          expect(await task.getTaskAmount(token.address)).to.be.equal(balance)
        })
      })
    })
  })


  describe('setBalanceConnectors', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
        await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
        task = task.connect(owner)
      })

      const itCanBeSet = (previous: string, next: string) => {
        it('can be set', async () => {
          const tx = await task.setBalanceConnectors(previous, next)

          expect(await task.previousBalanceConnectorId()).to.be.equal(previous)
          expect(await task.nextBalanceConnectorId()).to.be.equal(next)

          await assertEvent(tx, 'BalanceConnectorsSet', { previous, next })
        })
      }

      context('when setting to non-zero', () => {
        context('when setting to different values', () => {
          const previous = '0x0000000000000000000000000000000000000000000000000000000000000001'
          const next = '0x0000000000000000000000000000000000000000000000000000000000000002'

          itCanBeSet(previous, next)
        })

        context('when setting to the same values', () => {
          const previous = '0x0000000000000000000000000000000000000000000000000000000000000001'
          const next = '0x0000000000000000000000000000000000000000000000000000000000000001'

          it('reverts', async () => {
            await expect(task.setBalanceConnectors(previous, next)).to.be.revertedWith('TASK_SAME_BALANCE_CONNECTORS')
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
      it('reverts', async () => {
        await expect(task.setBalanceConnectors(ZERO_BYTES32, ZERO_BYTES32)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('call', () => {
    const token = NATIVE_TOKEN_ADDRESS
    const amount = fp(0.01)

    context('when the task has a previous balance connector set', () => {
      const previousConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000001'

      beforeEach('set previous balance connector', async () => {
        const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
        await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
        await task.connect(owner).setBalanceConnectors(previousConnectorId, ZERO_BYTES32)
      })

      beforeEach('authorize task', async () => {
        const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
        await authorizer.connect(owner).authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
      })

      context('when there is enough balance in the connector', () => {
        beforeEach('increase previous connector balance', async () => {
          const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, updateBalanceConnectorRole, [])
          await smartVault.connect(owner).updateBalanceConnector(previousConnectorId, token, amount, true)
        })

        it('updates the balance connectors properly', async () => {
          const tx = await task.call(token, amount)

          await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
            id: previousConnectorId,
            token,
            amount,
            added: false,
          })
        })

        it('emits an Executed event', async () => {
          const tx = await task.call(token, amount)
          await assertEvent(tx, 'Executed')
        })
      })

      context('when there is not enough balance in the connector', () => {
        it('reverts', async () => {
          await expect(task.call(token, amount)).to.be.revertedWith('SMART_VAULT_CONNECTOR_NO_BALANCE')
        })
      })
    })

    context('when the task has no previous balance connector set', () => {
      it('does not update any balance connector', async () => {
        const tx = await task.call(token, amount)
        await assertNoIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated')
      })

      it('emits an Executed event', async () => {
        const tx = await task.call(token, amount)
        await assertEvent(tx, 'Executed')
      })
    })
  })
})
