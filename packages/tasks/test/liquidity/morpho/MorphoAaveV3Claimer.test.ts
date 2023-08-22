import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  deploy,
  deployProxy,
  getSigners,
  ONES_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../../dist'
import { itBehavesLikeBaseMorphoAaveV3Task } from './BaseMorphoAaveV3Task.behavior'

describe('MorphoAaveV3Claimer', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('MorphoAaveV3ConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'MorphoAaveV3Claimer',
      [],
      [
        {
          baseMorphoAaveV3Config: {
            connector: connector.address,
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ]
    )
  })

  describe('morpho-aave V3', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
    })

    itBehavesLikeBaseMorphoAaveV3Task('MORPHO_AAVE_V3_CLAIMER')
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

      context('when the amount is not zero', () => {
        const amount = 1

        context('when the token is the morpho token', () => {
          const MORPHO_TOKEN = '0x9994E35Db50125E0DF82e4c2dde62496CE330999'

          context('when the proof is not empty', () => {
            const proof = ['0x0000000000000000000000000000000000000000000000000000000000000001']

            const itExecutesTheTaskProperly = () => {
              it('executes the expected connector', async () => {
                const tx = await task.call(MORPHO_TOKEN, amount, proof)

                const connectorData = connector.interface.encodeFunctionData('claim', [amount, proof])
                await assertIndirectEvent(tx, smartVault.interface, 'Executed', { connector, data: connectorData })
                await assertIndirectEvent(tx, connector.interface, 'LogClaim', { token: MORPHO_TOKEN, amount })
              })

              it('emits an Executed event', async () => {
                const tx = await task.call(MORPHO_TOKEN, amount, proof)
                await assertEvent(tx, 'Executed')
              })
            }

            context('without balance connectors', () => {
              itExecutesTheTaskProperly()

              it('does not update any balance connectors', async () => {
                const tx = await task.call(MORPHO_TOKEN, amount, proof)

                await assertNoEvent(tx, 'BalanceConnectorUpdated')
              })
            })

            context('with balance connectors', () => {
              const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'

              beforeEach('set balance connectors', async () => {
                const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)
              })

              beforeEach('authorize task to update balance connectors', async () => {
                const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                await authorizer
                  .connect(owner)
                  .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
              })

              itExecutesTheTaskProperly()

              it('updates the balance connectors properly', async () => {
                const tx = await task.call(MORPHO_TOKEN, amount, proof)

                await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                  id: nextConnectorId,
                  token: MORPHO_TOKEN,
                  amount: amount,
                  added: true,
                })
              })
            })
          })

          context('when the proof is empty', () => {
            const proof = []

            it('reverts', async () => {
              await expect(task.call(MORPHO_TOKEN, amount, proof)).to.be.revertedWith('TaskProofEmpty')
            })
          })
        })

        context('when the token is not the morpho token', () => {
          const token = ONES_ADDRESS

          it('reverts', async () => {
            await expect(task.call(token, amount, [])).to.be.revertedWith('TaskTokenNotMorpho')
          })
        })
      })

      context('when the amount is zero', () => {
        const amount = 0

        it('reverts', async () => {
          await expect(task.call(ONES_ADDRESS, amount, [])).to.be.revertedWith('TaskAmountZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ONES_ADDRESS, 0, [])).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
