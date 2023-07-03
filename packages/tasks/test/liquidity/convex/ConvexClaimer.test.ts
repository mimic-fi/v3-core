import { OP } from '@mimic-fi/v3-authorizer'
import { assertEvent, assertIndirectEvent, deploy, deployProxy, getSigners, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../../'
import { itBehavesLikeBaseConvexTask } from './BaseConvexTask.behavior'

describe('ConvexClaimer', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('ConvexConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'ConvexClaimer',
      [],
      [
        {
          baseConvexConfig: {
            connector: connector.address,
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ]
    )
  })

  describe('convex', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
    })

    itBehavesLikeBaseConvexTask()
  })

  describe('call', () => {
    beforeEach('authorize task', async () => {
      const executeRole = smartVault.interface.getSighash('execute')
      const params = [{ op: OP.EQ, value: connector.address }]
      await authorizer.connect(owner).authorize(task.address, smartVault.address, executeRole, params)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the pool is not zero', () => {
        let pool: Contract

        beforeEach('deploy pool', async () => {
          pool = await deploy('TokenMock', ['TKN'])
        })

        it('executes the expected connector', async () => {
          const tx = await task.call(pool.address)

          const connectorData = connector.interface.encodeFunctionData('claim', [pool.address])
          await assertIndirectEvent(tx, smartVault.interface, 'Executed', { connector, data: connectorData })
          await assertIndirectEvent(tx, connector.interface, 'LogClaim', { pool })
        })

        it('emits an Executed event', async () => {
          const tx = await task.call(pool.address)
          await assertEvent(tx, 'Executed')
        })
      })

      context('when the pool is zero', () => {
        const pool = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(pool)).to.be.revertedWith('TASK_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
