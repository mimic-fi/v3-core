import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'

describe('Collector', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress, tokensSource: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, tokensSource] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'Collector',
      [],
      [
        {
          tokensSource: tokensSource.address,
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })

  describe('execution type', () => {
    it('defines it correctly', async () => {
      const expectedType = ethers.utils.solidityKeccak256(['string'], ['COLLECTOR'])
      expect(await task.EXECUTION_TYPE()).to.be.equal(expectedType)
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
        const next = '0x0000000000000000000000000000000000000000000000000000000000000001'

        context('when setting previous to zero', () => {
          const previous = ZERO_BYTES32

          itCanBeSet(previous, next)
        })

        context('when setting previous to non-zero', () => {
          const previous = '0x0000000000000000000000000000000000000000000000000000000000000002'

          it('reverts', async () => {
            await expect(task.setBalanceConnectors(previous, next)).to.be.revertedWith(
              'TASK_PREVIOUS_CONNECTOR_NOT_ZERO'
            )
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

  describe('setTokensSource', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setTokensSourceRole = task.interface.getSighash('setTokensSource')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokensSourceRole, [])
        task = task.connect(owner)
      })

      context('when the new address is not zero', async () => {
        let newTokensSource: SignerWithAddress

        beforeEach('set new tokens source', async () => {
          newTokensSource = tokensSource
        })

        it('sets the tokens source', async () => {
          await task.setTokensSource(newTokensSource.address)
          expect(await task.getTokensSource()).to.be.equal(newTokensSource.address)
        })

        it('emits an event', async () => {
          const tx = await task.setTokensSource(newTokensSource.address)
          await assertEvent(tx, 'TokensSourceSet', { tokensSource: newTokensSource })
        })
      })

      context('when the new address is zero', async () => {
        const newSource = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.setTokensSource(newSource)).to.be.revertedWith('TASK_TOKENS_SOURCE_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTokensSource(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let token: Contract

    const threshold = fp(2)

    beforeEach('set token and', async () => {
      token = await deploy('TokenMock', ['USDC'])
    })

    beforeEach('authorize task', async () => {
      const collectRole = smartVault.interface.getSighash('collect')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, collectRole, [])
    })

    beforeEach('set tokens source', async () => {
      const setTokensSourceRole = task.interface.getSighash('setTokensSource')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTokensSourceRole, [])
      await task.connect(owner).setTokensSource(tokensSource.address)
    })

    beforeEach('set tokens acceptance type', async () => {
      const setTokensAcceptanceTypeRole = task.interface.getSighash('setTokensAcceptanceType')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceTypeRole, [])
      await task.connect(owner).setTokensAcceptanceType(1)
    })

    beforeEach('set tokens acceptance list', async () => {
      const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
      await task.connect(owner).setTokensAcceptanceList([token.address], [true])
    })

    beforeEach('set default token threshold', async () => {
      const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
      await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
      await task.connect(owner).setDefaultTokenThreshold({ token: token.address, min: threshold, max: 0 })
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the given token is allowed', () => {
        context('when the threshold has passed', () => {
          const amount = threshold

          beforeEach('allow smart vault', async () => {
            await token.mint(tokensSource.address, amount)
            await token.connect(tokensSource).approve(smartVault.address, amount)
          })

          it('calls the collect primitive', async () => {
            const tx = await task.call(token.address, amount)

            await assertIndirectEvent(tx, smartVault.interface, 'Collected', { token, from: tokensSource, amount })
          })

          it('emits an Executed event', async () => {
            const tx = await task.call(token.address, amount)

            await assertEvent(tx, 'Executed')
          })

          it('updates the balance connectors properly', async () => {
            const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'
            const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
            await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
            await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)

            const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
            await authorizer.connect(owner).authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])

            const tx = await task.call(token.address, amount)

            await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
              id: nextConnectorId,
              token,
              amount,
              added: true,
            })
          })
        })

        context('when the threshold has not passed', () => {
          const amount = threshold.sub(1)

          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, amount)
          })

          it('reverts', async () => {
            await expect(task.call(token.address, amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
          })
        })
      })

      context('when the given token is not allowed', () => {
        it('reverts', async () => {
          await expect(task.call(NATIVE_TOKEN_ADDRESS, 0)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(token.address, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
