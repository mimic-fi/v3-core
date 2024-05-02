import {
  assertEvent,
  deploy,
  deployProxy,
  deployTokenMock,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ONES_ADDRESS,
  ONES_BYTES32,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseSwapTask } from './BaseSwapTask.behavior'

describe('BalancerV2Swapper', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract, owner: SignerWithAddress

  const balancerPoolIds = [
    { token: NATIVE_TOKEN_ADDRESS, poolId: ONES_BYTES32 },
    { token: ONES_ADDRESS, poolId: '0x2222222222222222222222222222222222222222222222222222222222222222' },
  ]

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner] = await getSigners()
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('BalancerV2SwapConnectorMock', [ZERO_ADDRESS])
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'BalancerV2Swapper',
      [],
      [
        {
          balancerPoolIds,
          baseSwapConfig: {
            connector: connector.address,
            tokenOut: ZERO_ADDRESS,
            maxSlippage: 0,
            customTokensOut: [],
            customMaxSlippages: [],
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ]
    )
  })

  describe('setPoolId', () => {
    let token: Contract

    before('deploy token mock', async () => {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setPoolIdRole = task.interface.getSighash('setPoolId')
        await authorizer.connect(owner).authorize(owner.address, task.address, setPoolIdRole, [])
        task = task.connect(owner)
      })

      context('when the pool id is not zero', () => {
        const poolId = ONES_BYTES32

        it('emits an event', async () => {
          const tx = await task.setPoolId(token.address, poolId)
          await assertEvent(tx, 'BalancerPoolIdSet', { token: token.address, poolId })
        })

        context('when modifying the pool id', () => {
          beforeEach('set pool id', async () => {
            await task.setPoolId(token.address, poolId)
          })

          it('updates the pool id', async () => {
            const poolId = '0x0000000000000000000000000000000000000000000000000000000000000001'
            const tx = await task.setPoolId(token.address, poolId)
            await assertEvent(tx, 'BalancerPoolIdSet', { token: token.address, poolId })
          })
        })
      })

      context('when the token address is zero', () => {
        it('reverts', async () => {
          await expect(
            task.setPoolId(ZERO_ADDRESS, '0x0000000000000000000000000000000000000000000000000000000000000001')
          ).to.be.revertedWith('TaskTokenZero')
        })
      })
    })
  })

  describe('swapper', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
    })

    it('initializes the corresponding pool IDs', async () => {
      for (const { token, poolId } of balancerPoolIds) {
        const actualPoolId = await task.balancerPoolId(token)
        expect(actualPoolId).to.equal(poolId)
      }
    })

    itBehavesLikeBaseSwapTask('BALANCER_V2_SWAPPER')
  })
})
